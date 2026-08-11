import type { Metadata } from "next";
import { Archive, ArchiveRestore } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { ACCOUNT_TYPE_LABELS, listAccounts } from "@/server/accounts";
import { getTotalBalance } from "@/server/reports";
import { formatCents } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AccountForm } from "./account-form";
import { toggleArchiveAccountAction } from "./actions";

export const metadata: Metadata = { title: "Contas" };

export default async function ContasPage() {
  const session = await requireSession("/contas");
  const [accounts, total] = await Promise.all([
    listAccounts(session.workspaceId, true),
    getTotalBalance(session.workspaceId),
  ]);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contas"
        description="Onde o seu dinheiro está guardado."
      />

      <Card className="animate-rise">
        <p className="text-xs font-medium text-muted">Saldo total</p>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">
          {formatCents(total)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {active.length} conta{active.length === 1 ? "" : "s"} ativa
          {active.length === 1 ? "" : "s"}
        </p>
      </Card>

      <AccountForm />

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Ainda não tem contas"
            description="Comece pela conta onde recebe o ordenado. Indique o saldo que tem agora e o resto calcula-se sozinho."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {active.map((account) => (
            <li key={account.id}>
              <Card className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {account.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                    {account.institution ? ` · ${account.institution}` : ""}
                  </p>
                </div>
                <p
                  className={`tabular shrink-0 text-sm font-semibold ${
                    account.cachedBalanceCents < 0 ? "text-negative" : "text-ink"
                  }`}
                >
                  {formatCents(account.cachedBalanceCents)}
                </p>
                <form action={toggleArchiveAccountAction} className="shrink-0">
                  <input type="hidden" name="id" value={account.id} />
                  <button
                    type="submit"
                    title="Arquivar conta"
                    aria-label={`Arquivar ${account.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-ink"
                  >
                    <Archive size={15} aria-hidden />
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <section>
          <h2 className="mt-6 mb-2 text-xs font-semibold text-muted">
            Arquivadas
          </h2>
          <p className="mb-2 text-[11px] text-faint">
            Contas arquivadas não aparecem nos formulários, mas o histórico
            mantém-se intacto.
          </p>
          <ul className="space-y-2">
            {archived.map((account) => (
              <li key={account.id}>
                <Card className="flex items-center gap-3 p-3.5 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{account.name}</p>
                    <Badge>Arquivada</Badge>
                  </div>
                  <p className="tabular shrink-0 text-sm text-muted">
                    {formatCents(account.cachedBalanceCents)}
                  </p>
                  <form action={toggleArchiveAccountAction} className="shrink-0">
                    <input type="hidden" name="id" value={account.id} />
                    <button
                      type="submit"
                      title="Reativar conta"
                      aria-label={`Reativar ${account.name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-hover hover:text-ink"
                    >
                      <ArchiveRestore size={15} aria-hidden />
                    </button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
