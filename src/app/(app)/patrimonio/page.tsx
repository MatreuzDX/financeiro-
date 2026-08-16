import type { Metadata } from "next";
import { Landmark, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { listAccounts, ACCOUNT_TYPE_LABELS } from "@/server/accounts";
import { getEvolution } from "@/server/reports";
import { listGoals } from "@/server/goals";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  InfoNote,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { BalanceChart } from "@/components/charts";

export const metadata: Metadata = { title: "Património" };

/**
 * Património líquido: o que tem menos o que deve.
 *
 * É o ecrã central da Maybe Finance, e faltava aqui. O saldo diz o que tem
 * hoje na conta; o património diz onde está, ao todo — e é o número que
 * mostra progresso ao longo de anos, quando o saldo do mês não mostra nada.
 *
 * Os tipos de conta é que decidem o que é bem e o que é dívida. Nada é
 * estimado: se não estiver registado, não entra.
 */
const TIPOS_DIVIDA = new Set(["CARD", "LOAN"]);

export default async function PatrimonioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/patrimonio");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo ?? "ano",
    de: params.de,
    ate: params.ate,
    today,
  });

  const [contas, evolucao, metas] = await Promise.all([
    listAccounts(session.workspaceId),
    getEvolution(session.workspaceId, period),
    listGoals(session.workspaceId, session.timezone),
  ]);

  const bens = contas.filter((c) => !TIPOS_DIVIDA.has(c.type));
  const dividas = contas.filter((c) => TIPOS_DIVIDA.has(c.type));

  const totalBens = bens.reduce((s, c) => s + c.cachedBalanceCents, 0);
  // Um cartão com saldo negativo é dívida; guardamos o valor em positivo
  // para o mostrar como "o que deve".
  const totalDividas = dividas.reduce(
    (s, c) => s + Math.abs(Math.min(0, c.cachedBalanceCents)),
    0,
  );
  const patrimonio = totalBens - totalDividas;
  const guardadoEmMetas = metas.reduce((s, m) => s + m.savedCents, 0);

  const serie = evolucao.map((p) => ({
    label: p.label,
    incomeCents: p.incomeCents,
    expenseCents: p.expenseCents,
    balanceCents: p.balanceCents,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Património"
        description="O que tem, menos o que deve."
      />

      <Card className="animate-rise bg-linear-to-br from-primary-soft to-surface">
        <p className="text-xs font-medium text-muted">Património líquido</p>
        <p
          className={`tabular mt-1 text-4xl font-semibold tracking-tight ${
            patrimonio < 0 ? "text-negative" : "text-ink"
          }`}
        >
          {formatCents(patrimonio)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {formatCents(totalBens)} em bens
          {totalDividas > 0 ? ` menos ${formatCents(totalDividas)} de dívidas` : ""}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Wallet size={13} className="text-muted" aria-hidden />
            <p className="text-[11px] font-medium text-muted">O que tem</p>
          </div>
          <p className="tabular text-lg font-semibold text-positive sm:text-xl">
            {formatCents(totalBens)}
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Landmark size={13} className="text-muted" aria-hidden />
            <p className="text-[11px] font-medium text-muted">O que deve</p>
          </div>
          <p className="tabular text-lg font-semibold text-negative sm:text-xl">
            {formatCents(totalDividas)}
          </p>
        </Card>
      </div>

      {guardadoEmMetas > 0 ? (
        <Card className="animate-rise">
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"
              aria-hidden
            >
              <PiggyBank size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <strong className="tabular">{formatCents(guardadoEmMetas)}</strong>{" "}
                com destino marcado
              </p>
              <p className="text-[11px] text-muted">
                Já contado acima. Está nas contas, mas tem dono.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="animate-rise">
        <CardHeader
          title="Como tem evoluído"
          hint={period.label}
          action={
            <TrendingUp size={15} className="text-muted" aria-hidden />
          }
        />
        <BalanceChart data={serie} />
      </Card>

      <Card className="animate-rise">
        <CardHeader title="Onde está" />
        {contas.length === 0 ? (
          <EmptyState
            title="Ainda sem contas"
            description="O património calcula-se a partir das contas registadas."
            action={
              <LinkButton href="/contas" size="sm">
                Criar conta
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {[...bens, ...dividas].map((conta) => {
              const divida = TIPOS_DIVIDA.has(conta.type);
              return (
                <li
                  key={conta.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{conta.name}</p>
                    <p className="text-[11px] text-muted">
                      {ACCOUNT_TYPE_LABELS[conta.type]}
                      {divida ? " · conta como dívida" : ""}
                    </p>
                  </div>
                  <p
                    className={`tabular shrink-0 text-sm font-medium ${
                      conta.cachedBalanceCents < 0 ? "text-negative" : "text-ink"
                    }`}
                  >
                    {formatCents(conta.cachedBalanceCents)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <InfoNote>
        Cartões de crédito e empréstimos contam como dívida; o resto conta
        como bem. Só entra o que está registado — não há aqui casas, carros
        nem investimentos avaliados por estimativa.
      </InfoNote>
    </div>
  );
}
