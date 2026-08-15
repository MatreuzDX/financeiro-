import type { Metadata } from "next";
import { Check, Power, Repeat, Trash2, TriangleAlert } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import {
  FREQUENCY_LABELS,
  gerarOcorrencias,
  listRecurring,
  listarVencimentos,
} from "@/server/recurring";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { todayIso, formatRelativeDay } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  InfoNote,
  Money,
  PageHeader,
} from "@/components/ui";
import { RecurringForm } from "./recurring-form";
import {
  confirmarPagamentoAction,
  deleteRecurringAction,
  dispensarVencimentoAction,
  toggleRecurringAction,
} from "./actions";

export const metadata: Metadata = { title: "Recorrentes" };

export default async function RecorrentesPage() {
  const session = await requireSession("/recorrentes");
  const today = todayIso(session.timezone);

  // Gera o que faltar antes de mostrar. Sem cron: corre quando alguém abre a
  // página, o que para uso pessoal chega e evita infraestrutura que pode
  // falhar em silêncio.
  await gerarOcorrencias(session.workspaceId, session.timezone);

  const [regras, vencimentos, contas, despesas, receitas] = await Promise.all([
    listRecurring(session.workspaceId),
    listarVencimentos(session.workspaceId, session.timezone, 45),
    listAccounts(session.workspaceId),
    listCategories(session.workspaceId, "EXPENSE"),
    listCategories(session.workspaceId, "INCOME"),
  ]);

  const atrasadas = vencimentos.filter((v) => v.atrasada);
  const aVir = vencimentos.filter((v) => !v.atrasada);
  const totalAPagar = vencimentos
    .filter((v) => v.type === "EXPENSE")
    .reduce((s, v) => s + v.amountCents, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contas a pagar"
        description="O que se repete todos os meses, e o que está para vir."
      />

      <Card className="animate-rise">
        <p className="text-xs font-medium text-muted">
          Previsto nos próximos 45 dias
        </p>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">
          {formatCents(totalAPagar)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {vencimentos.length} movimento{vencimentos.length === 1 ? "" : "s"} previsto
          {vencimentos.length === 1 ? "" : "s"}
        </p>
      </Card>

      <InfoNote>
        Um movimento previsto <strong>não</strong> mexe no saldo nem no lucro.
        Só conta quando confirmar que aconteceu — dinheiro que ainda não saiu
        da conta não pode aparecer como se tivesse saído.
      </InfoNote>

      {/* ── Atrasadas ───────────────────────────────────────────────────── */}
      {atrasadas.length > 0 ? (
        <Card className="animate-rise border-warning/40">
          <CardHeader
            title={
              <span className="flex items-center gap-1.5 text-warning">
                <TriangleAlert size={15} aria-hidden />
                {atrasadas.length === 1
                  ? "1 conta passou do prazo"
                  : `${atrasadas.length} contas passaram do prazo`}
              </span>
            }
            hint="Confirme se já pagou, ou dispense se não se aplica este mês."
          />
          <ul className="divide-y divide-line">
            {atrasadas.map((v) => (
              <LinhaVencimento key={v.id} vencimento={v} hoje={today} />
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Por vir ─────────────────────────────────────────────────────── */}
      <Card className="animate-rise">
        <CardHeader title="O que vem aí" hint="Próximos 45 dias" />
        {aVir.length === 0 ? (
          <EmptyState
            title="Nada previsto"
            description="Quando criar uma recorrência, as próximas ocorrências aparecem aqui antes de acontecerem."
          />
        ) : (
          <ul className="divide-y divide-line">
            {aVir.map((v) => (
              <LinhaVencimento key={v.id} vencimento={v} hoje={today} />
            ))}
          </ul>
        )}
      </Card>

      {/* ── As regras ───────────────────────────────────────────────────── */}
      <RecurringForm
        accounts={contas.map((c) => ({ id: c.id, name: c.name }))}
        expenseCategories={despesas.map((c) => ({ id: c.id, name: c.name }))}
        incomeCategories={receitas.map((c) => ({ id: c.id, name: c.name }))}
        today={today}
      />

      <Card className="animate-rise">
        <CardHeader
          title="As suas recorrências"
          hint={`${regras.filter((r) => r.active).length} ativa(s)`}
        />
        {regras.length === 0 ? (
          <EmptyState
            icon={<Repeat size={26} aria-hidden />}
            title="Ainda sem recorrências"
            description="Renda, internet, telemóvel, ordenado. Cria-se uma vez e deixa de se escrever todos os meses."
          />
        ) : (
          <ul className="divide-y divide-line">
            {regras.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{
                    background: r.active
                      ? (r.category?.color ??
                        (r.type === "INCOME"
                          ? "var(--positive)"
                          : "var(--negative)"))
                      : "var(--faint)",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      r.active ? "text-ink" : "text-faint line-through",
                    )}
                  >
                    {r.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {FREQUENCY_LABELS[r.frequency]}
                    {r.frequency !== "WEEKLY" && r.dayOfMonth
                      ? `, dia ${r.dayOfMonth}`
                      : ""}
                    {" · "}
                    {r.category?.name ?? "sem categoria"}
                    {" · "}
                    {r.account.name}
                  </p>
                </div>

                <Money
                  cents={
                    r.type === "EXPENSE" ? -r.amountCents : r.amountCents
                  }
                  tone={r.type === "INCOME" ? "positive" : "negative"}
                  className="shrink-0 text-sm font-medium"
                />

                <form action={toggleRecurringAction} className="shrink-0">
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    title={r.active ? "Desligar" : "Ligar"}
                    aria-label={`${r.active ? "Desligar" : "Ligar"} ${r.name}`}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-surface-hover",
                      r.active ? "text-primary" : "text-faint",
                    )}
                  >
                    <Power size={15} aria-hidden />
                  </button>
                </form>

                <form action={deleteRecurringAction} className="shrink-0">
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    title="Apagar recorrência"
                    aria-label={`Apagar ${r.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LinhaVencimento({
  vencimento: v,
  hoje,
}: {
  vencimento: Awaited<ReturnType<typeof listarVencimentos>>[number];
  hoje: string;
}) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{v.description}</p>
        <p className="truncate text-[11px] text-muted">
          {formatRelativeDay(v.date, hoje)}
          {v.categoryName ? ` · ${v.categoryName}` : ""}
          {v.atrasada ? (
            <>
              {" · "}
              <Badge tone="warning">
                {Math.abs(v.diasAteVencer)} dia
                {Math.abs(v.diasAteVencer) === 1 ? "" : "s"} de atraso
              </Badge>
            </>
          ) : null}
        </p>
      </div>

      <Money
        cents={v.type === "EXPENSE" ? -v.amountCents : v.amountCents}
        tone={v.type === "INCOME" ? "positive" : "negative"}
        className="shrink-0 text-sm font-medium"
      />

      <form action={confirmarPagamentoAction} className="shrink-0">
        <input type="hidden" name="id" value={v.id} />
        <input type="hidden" name="data" value={v.atrasada ? hoje : ""} />
        <button
          type="submit"
          title="Confirmar que aconteceu"
          aria-label={`Confirmar ${v.description}`}
          className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-positive-soft hover:text-positive"
        >
          <Check size={16} aria-hidden />
        </button>
      </form>

      <form action={dispensarVencimentoAction} className="shrink-0">
        <input type="hidden" name="id" value={v.id} />
        <button
          type="submit"
          title="Dispensar esta ocorrência"
          aria-label={`Dispensar ${v.description}`}
          className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </form>
    </li>
  );
}
