/**
 * Importação de extratos, contra a base de dados a sério.
 *
 * O que interessa provar aqui não é que a importação funciona uma vez — é o
 * que acontece na SEGUNDA vez. Extratos sobrepõem-se sempre, e um importador
 * que duplique movimentos destrói os números em silêncio.
 *
 * Precisa de `npm run db:start` a correr.
 */

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { createUserWithWorkspace } from "@/server/onboarding";
import { createAccount } from "@/server/accounts";
import {
  analisarExtrato,
  comerciante,
  confirmarImportacao,
  desfazerImportacao,
  fingerprint,
  withOrdinals,
} from "@/server/import";
import { createRule, matchRule } from "@/server/rules";

const criados: string[] = [];

const EXTRATO = [
  "Data;Descrição;Valor;Saldo",
  "15-08-2026;COMPRA 4321 PINGO DOCE LISBOA;-23,40;1.976,60",
  "16-08-2026;ORDENADO AGOSTO;920,00;2.896,60",
  "17-08-2026;PAGAMENTO EDP FATURA 993211;-61,20;2.835,40",
].join("\r\n");

async function cenario() {
  const sufixo = randomUUID().slice(0, 8);
  const user = await createUserWithWorkspace({
    name: "Importador",
    email: `imp-${sufixo}@exemplo.local`,
    password: "uma-Palavra-Passe-9!",
    workspaceName: `Espaço ${sufixo}`,
  });
  criados.push(user.workspaceId);

  const session: SessionUser = {
    sessionId: `s-${sufixo}`,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: "OWNER",
    mustChangePassword: false,
    theme: "SYSTEM",
    workspaceId: user.workspaceId,
    workspaceName: "Espaço",
    currency: "EUR",
    timezone: "Europe/Lisbon",
  };

  const conta = await createAccount(session, {
    name: `Banco ${sufixo}`,
    type: "BANK",
    openingCents: 0,
  });

  const despesa = await prisma.category.findFirstOrThrow({
    where: { workspaceId: user.workspaceId, type: "EXPENSE", archived: false },
  });
  const receita = await prisma.category.findFirstOrThrow({
    where: { workspaceId: user.workspaceId, type: "INCOME", archived: false },
  });

  return { session, contaId: conta.id, despesa, receita };
}

/** Transforma a pré-visualização em linhas prontas a gravar. */
function paraGravar(
  preview: Awaited<ReturnType<typeof analisarExtrato>>,
  despesaId: string,
  receitaId: string,
) {
  return preview.rows
    .filter((r) => !r.problem && !r.duplicate)
    .map((r) => ({
      date: r.date as string,
      description: r.description,
      amountCents: r.amountCents as number,
      categoryId:
        r.suggestedCategoryId ?? (r.type === "EXPENSE" ? despesaId : receitaId),
      scope: "PERSONAL" as const,
      hash: r.hash,
      matchedRuleId: r.matchedRuleId,
    }));
}

afterAll(async () => {
  for (const id of criados) {
    await prisma.workspace.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("analisar", () => {
  it("lê o extrato sem escrever nada na base de dados", async () => {
    const { session, contaId } = await cenario();

    const preview = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });

    expect(preview.resumo.total).toBe(3);
    expect(preview.resumo.prontos).toBe(3);
    expect(preview.resumo.entradasCents).toBe(92000);
    expect(preview.resumo.saidasCents).toBe(8460);
    expect(preview.resumo.de).toBe("2026-08-15");
    expect(preview.resumo.ate).toBe("2026-08-17");

    // Analisar não é importar.
    const contagem = await prisma.transaction.count({
      where: { workspaceId: session.workspaceId },
    });
    expect(contagem).toBe(0);
  });

  it("recusa um ficheiro que não é um extrato, em vez de importar lixo", async () => {
    const { session, contaId } = await cenario();
    await expect(
      analisarExtrato(session, {
        filename: "foto.jpg",
        text: "isto não é nada",
        accountId: contaId,
      }),
    ).rejects.toThrow();
  });

  it("não deixa importar para a conta de outro espaço", async () => {
    const a = await cenario();
    const b = await cenario();
    await expect(
      analisarExtrato(a.session, {
        filename: "extrato.csv",
        text: EXTRATO,
        accountId: b.contaId,
      }),
    ).rejects.toThrow(/conta válida/i);
  });
});

describe("importar", () => {
  it("grava os movimentos com o sinal certo e atualiza o saldo", async () => {
    const { session, contaId, despesa, receita } = await cenario();

    const preview = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    const { importados } = await confirmarImportacao(session, {
      filename: "extrato.csv",
      accountId: contaId,
      rows: paraGravar(preview, despesa.id, receita.id),
      totalRows: 3,
    });

    expect(importados).toBe(3);

    const tipos = await prisma.transaction.groupBy({
      by: ["type"],
      where: { workspaceId: session.workspaceId },
      _count: true,
    });
    expect(tipos.find((t) => t.type === "EXPENSE")?._count).toBe(2);
    expect(tipos.find((t) => t.type === "INCOME")?._count).toBe(1);

    // 920,00 − 23,40 − 61,20 = 835,40
    const conta = await prisma.account.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta.cachedBalanceCents).toBe(83540);
  });

  it("NÃO duplica quando o mesmo ficheiro é importado outra vez", async () => {
    const { session, contaId, despesa, receita } = await cenario();

    const primeiro = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    await confirmarImportacao(session, {
      filename: "extrato.csv",
      accountId: contaId,
      rows: paraGravar(primeiro, despesa.id, receita.id),
      totalRows: 3,
    });

    const segundo = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    expect(segundo.resumo.duplicados).toBe(3);
    expect(segundo.resumo.prontos).toBe(0);

    const total = await prisma.transaction.count({
      where: { workspaceId: session.workspaceId },
    });
    expect(total).toBe(3);
  });

  it("importa a parte nova de um extrato que se sobrepõe", async () => {
    const { session, contaId, despesa, receita } = await cenario();

    const p1 = await analisarExtrato(session, {
      filename: "agosto.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    await confirmarImportacao(session, {
      filename: "agosto.csv",
      accountId: contaId,
      rows: paraGravar(p1, despesa.id, receita.id),
      totalRows: 3,
    });

    const sobreposto = `${EXTRATO}\r\n18-08-2026;FARMACIA CENTRAL;-12,80;2.822,60`;
    const p2 = await analisarExtrato(session, {
      filename: "agosto-2.csv",
      text: sobreposto,
      accountId: contaId,
    });
    expect(p2.resumo.duplicados).toBe(3);
    expect(p2.resumo.prontos).toBe(1);

    await confirmarImportacao(session, {
      filename: "agosto-2.csv",
      accountId: contaId,
      rows: paraGravar(p2, despesa.id, receita.id),
      totalRows: 4,
    });

    expect(
      await prisma.transaction.count({ where: { workspaceId: session.workspaceId } }),
    ).toBe(4);
  });

  it("dois movimentos iguais no mesmo dia entram os DOIS", async () => {
    // O contrário desta expectativa é o bug perigoso: dois cafés de €1,20 no
    // mesmo sítio no mesmo dia não são um duplicado, são dois cafés.
    const { session, contaId, despesa, receita } = await cenario();
    const texto = [
      "Data;Descrição;Valor",
      "15-08-2026;CAFE CENTRAL;-1,20",
      "15-08-2026;CAFE CENTRAL;-1,20",
    ].join("\n");

    const preview = await analisarExtrato(session, {
      filename: "cafes.csv",
      text: texto,
      accountId: contaId,
    });
    expect(preview.resumo.prontos).toBe(2);

    const { importados } = await confirmarImportacao(session, {
      filename: "cafes.csv",
      accountId: contaId,
      rows: paraGravar(preview, despesa.id, receita.id),
      totalRows: 2,
    });
    expect(importados).toBe(2);

    // E reimportar o mesmo ficheiro continua a não duplicar.
    const outra = await analisarExtrato(session, {
      filename: "cafes.csv",
      text: texto,
      accountId: contaId,
    });
    expect(outra.resumo.duplicados).toBe(2);
  });
});

describe("desfazer", () => {
  it("apaga o lote inteiro e repõe o saldo", async () => {
    const { session, contaId, despesa, receita } = await cenario();

    const preview = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    const { batchId } = await confirmarImportacao(session, {
      filename: "extrato.csv",
      accountId: contaId,
      rows: paraGravar(preview, despesa.id, receita.id),
      totalRows: 3,
    });

    const { apagados } = await desfazerImportacao(session, batchId);
    expect(apagados).toBe(3);

    expect(
      await prisma.transaction.count({ where: { workspaceId: session.workspaceId } }),
    ).toBe(0);
    const conta = await prisma.account.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta.cachedBalanceCents).toBe(0);
  });

  it("depois de desfazer, o mesmo ficheiro pode ser importado de novo", async () => {
    // Se o `importHash` ficasse ocupado por uma linha apagada, a segunda
    // tentativa era recusada como duplicado e a pessoa ficava presa.
    const { session, contaId, despesa, receita } = await cenario();

    const p1 = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    const { batchId } = await confirmarImportacao(session, {
      filename: "extrato.csv",
      accountId: contaId,
      rows: paraGravar(p1, despesa.id, receita.id),
      totalRows: 3,
    });
    await desfazerImportacao(session, batchId);

    const p2 = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    expect(p2.resumo.prontos).toBe(3);
  });

  it("não deixa desfazer o lote de outro espaço", async () => {
    const a = await cenario();
    const b = await cenario();

    const preview = await analisarExtrato(a.session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: a.contaId,
    });
    const { batchId } = await confirmarImportacao(a.session, {
      filename: "extrato.csv",
      accountId: a.contaId,
      rows: paraGravar(preview, a.despesa.id, a.receita.id),
      totalRows: 3,
    });

    await expect(desfazerImportacao(b.session, batchId)).rejects.toThrow(
      /não encontrada/i,
    );
    expect(
      await prisma.transaction.count({ where: { workspaceId: a.session.workspaceId } }),
    ).toBe(3);
  });
});

describe("regras de categorização", () => {
  it("categorizam sozinhas na importação seguinte", async () => {
    const { session, contaId, despesa } = await cenario();

    await createRule(session, {
      label: "PINGO DOCE",
      categoryId: despesa.id,
      scope: "PERSONAL",
    });

    const preview = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });

    const pingo = preview.rows.find((r) => r.description.includes("PINGO DOCE"));
    expect(pingo?.suggestedCategoryId).toBe(despesa.id);
    expect(pingo?.suggestedCategoryName).toBe(despesa.name);

    // As outras não foram apanhadas por engano.
    const edp = preview.rows.find((r) => r.description.includes("EDP"));
    expect(edp?.suggestedCategoryId).toBeNull();
  });

  it("uma regra de despesa não categoriza uma receita", async () => {
    const { session, contaId, despesa } = await cenario();
    await createRule(session, {
      label: "ORDENADO",
      categoryId: despesa.id,
      scope: "PERSONAL",
    });

    const preview = await analisarExtrato(session, {
      filename: "extrato.csv",
      text: EXTRATO,
      accountId: contaId,
    });
    const ordenado = preview.rows.find((r) => r.description.includes("ORDENADO"));
    expect(ordenado?.type).toBe("INCOME");
    expect(ordenado?.suggestedCategoryId).toBeNull();
  });

  it("a regra mais específica ganha", () => {
    const regras = [
      { id: "curta", pattern: "continente", categoryId: "c1", scope: "PERSONAL" as const },
      {
        id: "longa",
        pattern: "continente bom dia",
        categoryId: "c2",
        scope: "PERSONAL" as const,
      },
    ];
    expect(matchRule("COMPRA CONTINENTE BOM DIA PORTO", regras)?.ruleId).toBe("longa");
    expect(matchRule("COMPRA CONTINENTE PORTO", regras)?.ruleId).toBe("curta");
  });

  it("compara sem acentos nem maiúsculas", () => {
    const regras = [
      { id: "r", pattern: "farmacia", categoryId: "c", scope: "PERSONAL" as const },
    ];
    expect(matchRule("Farmácia Central", regras)?.ruleId).toBe("r");
  });
});

describe("peças puras", () => {
  it("o comerciante sai limpo de referências que mudam sempre", () => {
    expect(comerciante("COMPRA 4321 PINGO DOCE LISBOA 12/08")).toBe(
      "PINGO DOCE LISBOA",
    );
    expect(comerciante("PAGAMENTO EDP FATURA 993211")).toBe("EDP FATURA");
  });

  it("as ocorrências repetidas são numeradas por ordem", () => {
    const linhas = [
      { date: "2026-08-15", amountCents: -120, description: "CAFE" },
      { date: "2026-08-15", amountCents: -120, description: "CAFE" },
      { date: "2026-08-16", amountCents: -120, description: "CAFE" },
    ];
    expect(withOrdinals(linhas)).toEqual([0, 1, 0]);
  });

  it("a mesma linha em contas diferentes dá impressões digitais diferentes", () => {
    const a = fingerprint("conta-a", "2026-08-15", -1200, "CAFE", 0);
    const b = fingerprint("conta-b", "2026-08-15", -1200, "CAFE", 0);
    expect(a).not.toBe(b);
  });
});
