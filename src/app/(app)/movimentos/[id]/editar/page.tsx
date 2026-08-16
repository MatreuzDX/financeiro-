import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth/guard";
import { getTransaction } from "@/server/ledger";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { listIncomeSources } from "@/server/income-sources";
import { listVehicles } from "@/server/vehicles";
import { todayIso } from "@/lib/date";
import { centsToInput } from "@/lib/money";
import { Card, InfoNote, PageHeader } from "@/components/ui";
import { TransactionForm } from "../../novo/transaction-form";

export const metadata: Metadata = { title: "Editar movimento" };

/**
 * Editar um movimento.
 *
 * Faltava por completo: `updateTransaction` existia no servidor desde o
 * início e não havia nenhuma forma de lá chegar — código morto e uma falha
 * básica. Quem se enganava no valor tinha de apagar e escrever tudo de novo.
 */
export default async function EditarMovimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession(`/movimentos/${id}/editar`);

  const [movimento, contas, despesas, receitas, fontes, veiculos] =
    await Promise.all([
      getTransaction(session.workspaceId, id),
      listAccounts(session.workspaceId),
      listCategories(session.workspaceId, "EXPENSE"),
      listCategories(session.workspaceId, "INCOME"),
      listIncomeSources(session.workspaceId, true),
      listVehicles(session.workspaceId, true),
    ]);

  if (!movimento) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Editar movimento"
        description="A alteração fica registada na auditoria, com o antes e o depois."
      />

      <Card className="animate-rise">
        <TransactionForm
          modo="editar"
          transactionId={movimento.id}
          accounts={contas.map((a) => ({ id: a.id, name: a.name }))}
          expenseCategories={despesas.map((c) => ({ id: c.id, name: c.name }))}
          incomeCategories={receitas.map((c) => ({ id: c.id, name: c.name }))}
          incomeSources={fontes.map((s) => ({ id: s.id, name: s.name }))}
          vehicles={veiculos.map((v) => ({ id: v.id, name: v.name }))}
          today={todayIso(session.timezone)}
          initialType={movimento.type}
          initialValues={{
            amount: centsToInput(movimento.amountCents),
            description: movimento.description,
            date: movimento.date,
            scope: movimento.scope,
            accountId: movimento.accountId ?? "",
            categoryId: movimento.categoryId ?? "",
            notes: movimento.notes ?? "",
          }}
        />
      </Card>

      {movimento.type === "TRANSFER" ? (
        <div className="mt-4">
          <InfoNote>
            Numa transferência, escolha outra vez as contas de origem e de
            destino — o formulário não as consegue pré-preencher com segurança.
          </InfoNote>
        </div>
      ) : null}
    </div>
  );
}
