"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/server/auth/guard";
import { createTransaction } from "@/server/ledger";
import { prisma } from "@/server/db";
import { parseAmountToCents } from "@/lib/money";
import { todayIso } from "@/lib/date";

export type RapidoState = {
  error?: string;
  guardado?: string;
  /**
   * Quantos foram guardados nesta sessão do painel. Serve de chave para o
   * formulário se remontar limpo — em vez de o limpar dentro de um efeito,
   * que é a receita para atualizações em cascata.
   */
  n?: number;
};

/**
 * Registo em três toques.
 *
 * É a ação mais repetida da app inteira. Se cansar, deixa-se de registar; e
 * uma app de finanças com dados a meio é pior do que nenhuma, porque os
 * números passam a mentir com ar de verdade.
 *
 * Por isso aqui não há data (é hoje), não há notas, não há âmbito. Valor,
 * categoria, gravar. Tudo o resto edita-se depois, se for preciso.
 */
export async function registoRapidoAction(
  prev: RapidoState,
  formData: FormData,
): Promise<RapidoState> {
  const n = prev.n ?? 0;
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error, n };

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null || amountCents <= 0) {
    return { error: "Escreva um valor, por exemplo 12,40.", n };
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) return { error: "Escolha uma categoria.", n };

  // A conta não se pergunta: usa-se a primeira, que é a que quase toda a
  // gente usa. Trocar de conta é o caso raro e tem o formulário completo.
  const conta = await prisma.account.findFirst({
    where: { workspaceId: guard.session.workspaceId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
  if (!conta) return { error: "Crie primeiro uma conta.", n };

  const categoria = await prisma.category.findFirst({
    where: { id: categoryId, workspaceId: guard.session.workspaceId },
    select: { name: true, type: true },
  });
  if (!categoria) return { error: "Categoria inválida.", n };

  const descricao =
    String(formData.get("description") ?? "").trim() || categoria.name;

  try {
    await createTransaction(guard.session, {
      type: categoria.type,
      date: todayIso(guard.session.timezone),
      description: descricao,
      amountCents,
      accountId: conta.id,
      categoryId,
      scope: "PERSONAL",
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
      n,
    };
  }

  revalidatePath("/", "layout");
  return { guardado: `${descricao} · ${conta.name}`, n: n + 1 };
}
