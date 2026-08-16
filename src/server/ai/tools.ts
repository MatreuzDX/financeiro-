/**
 * As ferramentas do assistente.
 *
 * REGRA QUE NÃO SE NEGOCEIA: o assistente não sabe nenhum número. Só sabe
 * fazer perguntas a estas funções, que vão à base de dados buscar a verdade.
 * Um chat que inventa valores numa app de dinheiro é pior do que não ter chat
 * nenhum — por isso o modelo nunca recebe os dados todos para "resumir": pede
 * o que precisa, e recebe exatamente isso.
 *
 * SEGURANÇA: o `workspaceId` NUNCA vem do modelo. Vem sempre da sessão, aqui
 * do lado. Se viesse do modelo, bastava convencê-lo a pedir outro para ler as
 * contas de outra pessoa.
 */

import "server-only";
import { prisma } from "@/server/db";
import { getByCategory, getEvolution, getSummary } from "@/server/reports";
import { getBudgetStatus } from "@/server/reports";
import { listAccounts } from "@/server/accounts";
import { listTransactions } from "@/server/ledger";
import { panoramaFiscal } from "@/server/fiscal";
import { formatCents } from "@/lib/money";
import { addMonths, endOfMonth, startOfMonth, startOfYear, todayIso } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export type ToolResult = {
  /** O que o modelo lê. Texto simples: números já formatados, sem ambiguidade. */
  texto: string;
  /** Um gráfico para mostrar à pessoa, quando faz sentido. */
  grafico?: Grafico;
};

export type Grafico =
  | { tipo: "barras"; titulo: string; pontos: { rotulo: string; cents: number }[] }
  | {
      tipo: "linha";
      titulo: string;
      pontos: { rotulo: string; entrouCents: number; saiuCents: number }[];
    }
  | { tipo: "circulo"; titulo: string; fatias: { rotulo: string; cents: number }[] };

/** O esquema que o modelo vê. Descrições em português, porque é a língua da app. */
export const FERRAMENTAS = [
  {
    name: "resumo",
    description:
      "Quanto entrou, quanto saiu e quanto sobrou num período. Use para " +
      "perguntas do tipo 'quanto gastei este mês' ou 'sobrou alguma coisa'.",
    input_schema: {
      type: "object" as const,
      properties: {
        de: { type: "string", description: "Data inicial, AAAA-MM-DD" },
        ate: { type: "string", description: "Data final, AAAA-MM-DD" },
        ambito: {
          type: "string",
          enum: ["TUDO", "PESSOAL", "PROFISSIONAL"],
          description: "Por omissão, tudo.",
        },
      },
      required: ["de", "ate"],
    },
  },
  {
    name: "gastos_por_categoria",
    description:
      "Para onde foi o dinheiro num período, categoria a categoria, da maior " +
      "para a menor. Devolve também um gráfico de círculo.",
    input_schema: {
      type: "object" as const,
      properties: {
        de: { type: "string" },
        ate: { type: "string" },
      },
      required: ["de", "ate"],
    },
  },
  {
    name: "evolucao_mensal",
    description:
      "Entradas e saídas mês a mês. Use para perguntas sobre tendência, " +
      "comparação entre meses, ou 'estou a melhorar?'. Devolve um gráfico de linha.",
    input_schema: {
      type: "object" as const,
      properties: {
        meses: { type: "number", description: "Quantos meses para trás, entre 2 e 24" },
      },
      required: ["meses"],
    },
  },
  {
    name: "procurar_movimentos",
    description:
      "Procura movimentos pela descrição. Use quando a pergunta é sobre um " +
      "sítio ou coisa concreta: 'quanto gastei no Continente', 'quando paguei o seguro'.",
    input_schema: {
      type: "object" as const,
      properties: {
        texto: { type: "string" },
        de: { type: "string" },
        ate: { type: "string" },
      },
      required: ["texto", "de", "ate"],
    },
  },
  {
    name: "saldos",
    description: "Saldo de cada conta e o total.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "orcamento",
    description:
      "Como está o orçamento do mês: quanto foi definido e quanto já se gastou " +
      "em cada categoria.",
    input_schema: {
      type: "object" as const,
      properties: { mes: { type: "string", description: "AAAA-MM" } },
      required: ["mes"],
    },
  },
  {
    name: "impostos",
    description:
      "Situação fiscal de quem trabalha a recibos verdes: quanto faturou, " +
      "quanto tem de guardar para IVA, Segurança Social e IRS, e quanto do " +
      "saldo é mesmo dele.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "hoje",
    description:
      "A data de hoje no fuso da pessoa. Chame SEMPRE isto antes de calcular " +
      "qualquer período, em vez de assumir uma data.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

const AMBITOS = {
  PESSOAL: "PERSONAL",
  PROFISSIONAL: "BUSINESS",
} as const;

export async function executarFerramenta(
  session: SessionUser,
  nome: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const hoje = todayIso(session.timezone);
  const ws = session.workspaceId;

  switch (nome) {
    case "hoje":
      return { texto: `Hoje é ${hoje}. O ano corrente começou em ${startOfYear(hoje)}.` };

    case "resumo": {
      const de = String(args.de ?? startOfMonth(hoje));
      const ate = String(args.ate ?? hoje);
      const ambitoRaw = String(args.ambito ?? "TUDO");
      const scope = AMBITOS[ambitoRaw as keyof typeof AMBITOS];
      const s = await getSummary(ws, { from: de, to: ate }, scope);
      return {
        texto:
          `Período ${de} a ${ate}${scope ? ` (${ambitoRaw.toLowerCase()})` : ""}:\n` +
          `- entrou ${formatCents(s.incomeCents)}\n` +
          `- saiu ${formatCents(s.expenseCents)}\n` +
          `- sobrou ${formatCents(s.netCents)}`,
      };
    }

    case "gastos_por_categoria": {
      const de = String(args.de ?? startOfMonth(hoje));
      const ate = String(args.ate ?? hoje);
      const fatias = await getByCategory(ws, { from: de, to: ate }, "EXPENSE");
      if (fatias.length === 0) {
        return { texto: `Não há despesas registadas entre ${de} e ${ate}.` };
      }
      const linhas = fatias
        .slice(0, 15)
        .map((f) => `- ${f.name}: ${formatCents(f.cents)}`)
        .join("\n");
      return {
        texto: `Despesas de ${de} a ${ate}, da maior para a menor:\n${linhas}`,
        grafico: {
          tipo: "circulo",
          titulo: `Despesas de ${de} a ${ate}`,
          fatias: fatias.slice(0, 8).map((f) => ({ rotulo: f.name, cents: f.cents })),
        },
      };
    }

    case "evolucao_mensal": {
      const meses = Math.max(2, Math.min(24, Number(args.meses ?? 6)));
      const de = startOfMonth(addMonths(hoje, -(meses - 1)));
      const ate = endOfMonth(hoje);
      const pontos = await getEvolution(ws, {
        key: "ano",
        label: `Últimos ${meses} meses`,
        from: de,
        to: ate,
        previous: { from: startOfMonth(addMonths(de, -meses)), to: de },
      });
      if (pontos.length === 0) return { texto: "Ainda não há histórico suficiente." };
      const linhas = pontos
        .map(
          (p) =>
            `- ${p.label}: entrou ${formatCents(p.incomeCents)}, ` +
            `saiu ${formatCents(p.expenseCents)}`,
        )
        .join("\n");
      return {
        texto: `Últimos ${pontos.length} meses:\n${linhas}`,
        grafico: {
          tipo: "linha",
          titulo: `Entradas e saídas, últimos ${pontos.length} meses`,
          pontos: pontos.map((p) => ({
            rotulo: p.label,
            entrouCents: p.incomeCents,
            saiuCents: p.expenseCents,
          })),
        },
      };
    }

    case "procurar_movimentos": {
      const texto = String(args.texto ?? "");
      const de = String(args.de ?? startOfYear(hoje));
      const ate = String(args.ate ?? hoje);
      const { rows, total } = await listTransactions(
        ws,
        { from: de, to: ate, search: texto },
        { take: 25 },
      );
      if (rows.length === 0) {
        return { texto: `Não encontrei nada com "${texto}" entre ${de} e ${ate}.` };
      }
      const soma = rows
        .filter((r) => r.type === "EXPENSE")
        .reduce((s, r) => s + r.amountCents, 0);
      const linhas = rows
        .slice(0, 15)
        .map((r) => `- ${r.date} · ${r.description} · ${formatCents(r.amountCents)}`)
        .join("\n");
      return {
        texto:
          `${total} movimento(s) com "${texto}" entre ${de} e ${ate}. ` +
          `Despesas somam ${formatCents(soma)}.\n${linhas}` +
          (total > 15 ? `\n(mostrei os primeiros 15 de ${total})` : ""),
      };
    }

    case "saldos": {
      const contas = await listAccounts(ws);
      if (contas.length === 0) return { texto: "Ainda não há contas criadas." };
      const total = contas.reduce((s, c) => s + c.cachedBalanceCents, 0);
      const linhas = contas
        .map((c) => `- ${c.name}: ${formatCents(c.cachedBalanceCents)}`)
        .join("\n");
      return {
        texto: `Saldos:\n${linhas}\nTotal: ${formatCents(total)}`,
        grafico: {
          tipo: "barras",
          titulo: "Saldo por conta",
          pontos: contas.map((c) => ({ rotulo: c.name, cents: c.cachedBalanceCents })),
        },
      };
    }

    case "orcamento": {
      const mes = String(args.mes ?? hoje.slice(0, 7));
      const estado = await getBudgetStatus(ws, `${mes}-01`);
      if (estado.rows.length === 0) {
        return { texto: `Não há orçamento definido para ${mes}.` };
      }
      const texto = estado.rows
        .map(
          (l) =>
            `- ${l.name}: gastou ${formatCents(l.spentCents)} ` +
            `de ${formatCents(l.plannedCents)}${l.over ? " — ESTOUROU" : ""}`,
        )
        .join("\n");
      return {
        texto:
          `Orçamento de ${mes}: previu ${formatCents(estado.plannedTotal)}, ` +
          `gastou ${formatCents(estado.spentTotal)}.\n${texto}`,
      };
    }

    case "impostos": {
      const p = await panoramaFiscal(ws, session.timezone);
      if (!p.perfil.independente) {
        return {
          texto:
            "Esta pessoa não está configurada como trabalhador independente, " +
            "por isso não há impostos de atividade a calcular.",
        };
      }
      const parcelas = p.reservaAno.parcelas
        .map((x) => `- ${x.titulo}: ${formatCents(x.cents)} (${x.conta})`)
        .join("\n");
      return {
        texto:
          `Faturado este ano: ${formatCents(p.faturadoAnoCents)}\n` +
          `A guardar para o Estado: ${formatCents(p.reservaAno.guardarCents)}\n${parcelas}\n` +
          `Saldo nas contas: ${formatCents(p.saldoTotalCents)}\n` +
          `Mesmo seu: ${formatCents(p.mesmoSeuCents)}\n` +
          (p.isentoSs ? "Está no período de isenção da Segurança Social.\n" : "") +
          `Avisos: ${p.reservaAno.avisos.join(" ") || "nenhum"}`,
      };
    }

    default:
      return { texto: `Não existe nenhuma ferramenta chamada "${nome}".` };
  }
}

/** Perguntas propostas conforme o que a conta tem. Um campo vazio não convida. */
export async function sugestoes(session: SessionUser): Promise<string[]> {
  const [movimentos, temOrcamento, perfil] = await Promise.all([
    prisma.transaction.count({
      where: { workspaceId: session.workspaceId, deletedAt: null },
    }),
    prisma.budget.count({ where: { workspaceId: session.workspaceId } }),
    prisma.fiscalProfile.findUnique({
      where: { workspaceId: session.workspaceId },
      select: { independente: true },
    }),
  ]);

  if (movimentos === 0) {
    return [
      "Como é que começo a usar isto?",
      "O que é que devo registar primeiro?",
    ];
  }

  const base = [
    "Para onde foi o meu dinheiro este mês?",
    "Estou a gastar mais do que no mês passado?",
    "Onde é que dá para cortar sem dar por isso?",
  ];
  if (temOrcamento > 0) base.push("Como está o meu orçamento?");
  if (perfil?.independente) base.push("Quanto tenho de guardar para os impostos?");
  return base;
}
