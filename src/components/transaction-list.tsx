import { Trash2 } from "lucide-react";
import { formatRelativeDay, type IsoDate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import type { TransactionRow } from "@/server/ledger";
import { EmptyState, LinkButton, Money } from "@/components/ui";
import { deleteTransactionAction } from "@/app/(app)/movimentos/actions";

/**
 * Lista de movimentos agrupada por dia.
 *
 * No telemóvel não há tabela: cada movimento é uma linha legível com o valor
 * à direita. Tabelas de seis colunas num ecrã de 375px obrigam a scroll
 * horizontal, e ninguém faz scroll horizontal para ver as suas despesas.
 */
export function TransactionList({
  rows,
  today,
  emptyTitle = "Ainda não há movimentos",
  emptyDescription = "Registe a primeira receita ou despesa para começar.",
  canDelete = true,
}: {
  rows: TransactionRow[];
  today: IsoDate;
  emptyTitle?: string;
  emptyDescription?: string;
  canDelete?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <LinkButton href="/movimentos/novo" size="sm">
            Registar movimento
          </LinkButton>
        }
      />
    );
  }

  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const list = groups.get(row.date) ?? [];
    list.push(row);
    groups.set(row.date, list);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, items]) => {
        const dayTotal = items.reduce(
          (sum, r) =>
            sum +
            (r.type === "INCOME"
              ? r.amountCents
              : r.type === "EXPENSE"
                ? -r.amountCents
                : 0),
          0,
        );

        return (
          <section key={date}>
            <header className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted">
                {formatRelativeDay(date, today)}
              </h3>
              <span className="tabular text-[11px] text-faint">
                {dayTotal === 0 ? "" : formatCents(dayTotal)}
              </span>
            </header>

            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-hover"
                >
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{
                      background:
                        row.type === "TRANSFER"
                          ? "var(--muted)"
                          : row.type === "INCOME"
                            ? "var(--positive)"
                            : (row.categoryColor ?? "var(--negative)"),
                    }}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{row.description}</p>
                    <p className="truncate text-[11px] text-muted">
                      {row.type === "TRANSFER"
                        ? `${row.accountName ?? "?"} → ${row.toAccountName ?? "?"}`
                        : [row.categoryName, row.accountName]
                            .filter(Boolean)
                            .join(" · ")}
                      {row.scope === "BUSINESS" ? " · Profissional" : ""}
                      {row.vehicleName ? ` · ${row.vehicleName}` : ""}
                    </p>
                  </div>

                  <Money
                    cents={
                      row.type === "EXPENSE" ? -row.amountCents : row.amountCents
                    }
                    tone={
                      row.type === "INCOME"
                        ? "positive"
                        : row.type === "EXPENSE"
                          ? "negative"
                          : "plain"
                    }
                    className="shrink-0 text-sm font-medium"
                  />

                  {canDelete ? (
                    <form action={deleteTransactionAction} className="shrink-0">
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        title="Apagar movimento"
                        aria-label={`Apagar ${row.description}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
