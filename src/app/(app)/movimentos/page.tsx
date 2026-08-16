import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/guard";
import { listTransactions } from "@/server/ledger";
import { getSummary } from "@/server/reports";
import { resolvePeriod, periodToQuery } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import {
  Card,
  LinkButton,
  PageHeader,
  SuccessBanner,
} from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { TransactionList } from "@/components/transaction-list";
import { restoreTransactionAction } from "./actions";

export const metadata: Metadata = { title: "Movimentos" };

const PAGE_SIZE = 50;

export default async function MovimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/movimentos");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });

  const page = Math.max(1, Number(params.pagina ?? "1") || 1);
  const search = (params.pesquisa ?? "").trim();

  const [{ rows, total }, summary] = await Promise.all([
    listTransactions(
      session.workspaceId,
      { from: period.from, to: period.to, search: search || undefined },
      { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
    ),
    getSummary(session.workspaceId, { from: period.from, to: period.to }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = periodToQuery(period);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimentos"
        description={`${total} movimento${total === 1 ? "" : "s"} em ${period.label.toLowerCase()}`}
        action={
          <LinkButton href="/movimentos/novo" size="sm">
            Novo
          </LinkButton>
        }
      />

      {params.guardado ? (
        <SuccessBanner>Movimento guardado.</SuccessBanner>
      ) : null}

      {params.restaurado ? (
        <SuccessBanner>Movimento reposto.</SuccessBanner>
      ) : null}

      {/*
        Anular. Apagar é sempre "soft", por isso desfazer é só limpar o
        `deletedAt` — o que transforma um clique errado num susto de dois
        segundos em vez de trabalho perdido.
      */}
      {params.apagado ? (
        <div className="animate-fade flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
          <span className="flex-1 text-muted">Movimento apagado.</span>
          <form action={restoreTransactionAction}>
            <input type="hidden" name="id" value={params.apagado} />
            <button
              type="submit"
              className="text-xs font-medium text-primary hover:underline"
            >
              Anular
            </button>
          </form>
        </div>
      ) : null}

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <div className="grid grid-cols-3 gap-2">
        <SmallStat label="Entrou" value={formatCents(summary.incomeCents)} tone="positive" />
        <SmallStat label="Saiu" value={formatCents(summary.expenseCents)} tone="negative" />
        <SmallStat
          label="Sobrou"
          value={formatCents(summary.netCents)}
          tone={summary.netCents >= 0 ? "positive" : "negative"}
        />
      </div>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="periodo" value={period.key} />
        {period.key === "personalizado" ? (
          <>
            <input type="hidden" name="de" value={period.from} />
            <input type="hidden" name="ate" value={period.to} />
          </>
        ) : null}
        <input
          type="search"
          name="pesquisa"
          defaultValue={search}
          placeholder="Procurar na descrição ou nas notas…"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-xl border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-hover"
        >
          Procurar
        </button>
      </form>

      <TransactionList
        rows={rows}
        today={today}
        emptyTitle={
          search ? "Nada encontrado" : "Ainda não há movimentos neste período"
        }
        emptyDescription={
          search
            ? `Nenhum movimento corresponde a "${search}" em ${period.label.toLowerCase()}.`
            : "Registe a primeira receita ou despesa para começar."
        }
      />

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-2 pt-2">
          <PageLink
            href={`/movimentos?${query}&pagina=${page - 1}`}
            disabled={page <= 1}
          >
            Anterior
          </PageLink>
          <span className="text-xs text-muted">
            Página {page} de {pages}
          </span>
          <PageLink
            href={`/movimentos?${query}&pagina=${page + 1}`}
            disabled={page >= pages}
          >
            Seguinte
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative";
}) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`tabular mt-0.5 text-sm font-semibold ${
          tone === "positive" ? "text-positive" : "text-negative"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-xl border border-line px-3 py-1.5 text-xs text-faint">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-xl border border-line-strong px-3 py-1.5 text-xs text-ink hover:bg-surface-hover"
    >
      {children}
    </Link>
  );
}
