import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Repeat, Umbrella } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { construirRadar } from "@/server/radar";
import { formatCents } from "@/lib/money";
import { formatShort } from "@/lib/date";
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from "@/components/ui";

export const metadata: Metadata = { title: "Radar" };

const NIVEIS = {
  "sem-rede": { texto: "Sem rede", cor: "text-negative" },
  frágil: { texto: "Frágil", cor: "text-warning" },
  razoável: { texto: "Razoável", cor: "text-ink" },
  confortável: { texto: "Confortável", cor: "text-positive" },
} as const;

/**
 * O que a app percebe sozinha.
 *
 * Nada nesta página precisa de inteligência artificial nem de chave de API
 * nenhuma. São padrões nos próprios movimentos — e é de propósito: as
 * respostas mais úteis não podem depender de um serviço externo estar ligado.
 */
export default async function RadarPage() {
  const session = await requireSession("/radar");
  const r = await construirRadar(session.workspaceId, session.timezone);

  const vazio =
    r.subscricoes.length === 0 &&
    r.anomalias.length === 0 &&
    r.fundo.meses === null &&
    r.reparticao === null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Radar"
        description="Padrões que a app encontrou sozinha nos seus movimentos"
      />

      {vazio ? (
        <EmptyState
          title="Ainda não há padrões para encontrar"
          description="Estas conclusões saem de comparar meses. Com dois ou três meses de movimentos registados, esta página começa a dizer coisas."
        />
      ) : null}

      {/* ── Subscrições ───────────────────────────────────────────────── */}
      {r.subscricoes.length > 0 ? (
        <Card>
          <CardHeader
            title="O que paga sempre"
            hint={`${r.subscricoes.length} cobrança${r.subscricoes.length === 1 ? "" : "s"} regular${r.subscricoes.length === 1 ? "" : "es"}`}
          />
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Isto sai a{" "}
            <strong className="text-ink">
              {formatCents(r.subscricoesAnualCents)} por ano
            </strong>
            . Vale a pena olhar para a lista uma vez — quase sempre há lá uma
            coisa que já não se usa.
          </p>
          <ul className="divide-y divide-line">
            {r.subscricoes.map((s) => (
              <li key={s.nome} className="flex items-center gap-3 py-2.5">
                <Repeat size={15} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{s.nome}</p>
                  <p className="text-[11px] text-muted">
                    {formatCents(s.valorCents)} a cada {s.cadenciaDias} dias ·{" "}
                    {s.ocorrencias} vezes · última a {formatShort(s.ultimaData)}
                    {s.subiuCents > 0 ? (
                      <span className="text-warning">
                        {" "}
                        · subiu {formatCents(s.subiuCents)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="tabular shrink-0 text-right text-xs text-muted">
                  {formatCents(s.anualCents)}
                  <span className="block text-[10px] text-faint">por ano</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Anomalias ─────────────────────────────────────────────────── */}
      {r.anomalias.length > 0 ? (
        <Card>
          <CardHeader
            title="Fora do costume"
            hint="Despesas muito acima do habitual para a categoria"
          />
          <ul className="divide-y divide-line">
            {r.anomalias.map((a) => (
              <li key={a.movimento.id} className="flex items-center gap-3 py-2.5">
                <AlertTriangle
                  size={15}
                  className="shrink-0 text-warning"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {a.movimento.description}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatShort(a.movimento.date)} · {a.vezes}× o habitual em{" "}
                    {a.movimento.categoryName ?? "sem categoria"}, que ronda{" "}
                    {formatCents(a.habitualCents)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm font-medium text-negative">
                  {formatCents(a.movimento.amountCents)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Não quer dizer que esteja errado — uma revisão do carro é suposto
            custar mais do que o costume. Serve para nada passar despercebido,
            incluindo cobranças duplicadas.
          </p>
        </Card>
      ) : null}

      {/* ── Fundo de emergência ───────────────────────────────────────── */}
      {r.fundo.meses !== null ? (
        <Card>
          <CardHeader
            title="Se a receita parasse amanhã"
            hint={`Com base na média de ${r.mesesAnalisados} ${r.mesesAnalisados === 1 ? "mês" : "meses"}`}
          />
          <div className="flex items-center gap-3">
            <Umbrella size={22} className="shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="tabular text-xl font-semibold text-ink">
                {r.fundo.meses.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}{" "}
                {r.fundo.meses === 1 ? "mês" : "meses"}
              </p>
              <p className={`text-xs font-medium ${NIVEIS[r.fundo.nivel].cor}`}>
                {NIVEIS[r.fundo.nivel].texto}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <ProgressBar
              percent={Math.min(100, ((r.fundo.meses ?? 0) / 6) * 100)}
              tone={
                r.fundo.nivel === "sem-rede"
                  ? "negative"
                  : r.fundo.nivel === "frágil"
                    ? "warning"
                    : "primary"
              }
            />
            <div className="mt-1 flex justify-between text-[10px] text-faint">
              <span>0</span>
              <span>3 meses</span>
              <span>6 meses</span>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Gasta em média {formatCents(r.fundo.gastoMensalCents)} por mês e tem{" "}
            {formatCents(r.fundo.saldoCents)}.{" "}
            {r.fundo.faltamPara3Cents > 0
              ? `Faltam ${formatCents(r.fundo.faltamPara3Cents)} para chegar aos três meses, que é o mínimo geralmente aconselhado.`
              : r.fundo.faltamPara6Cents > 0
                ? `Já passou os três meses. Para os seis, faltam ${formatCents(r.fundo.faltamPara6Cents)}.`
                : "Está acima dos seis meses. É o patamar em que uma perda de rendimento deixa de ser uma emergência e passa a ser um problema com tempo para resolver."}
          </p>
        </Card>
      ) : null}

      {/* ── 50/30/20 ──────────────────────────────────────────────────── */}
      {r.reparticao ? (
        <Card>
          <CardHeader
            title="Para onde vai o que recebe"
            hint="A regra 50/30/20, aplicada aos seus números deste mês"
          />
          <div className="flex h-7 overflow-hidden rounded-lg">
            <Faixa
              percent={r.reparticao.necessidadesPercent}
              cor="bg-primary"
              titulo="Necessidades"
            />
            <Faixa
              percent={r.reparticao.desejosPercent}
              cor="bg-warning"
              titulo="Não essenciais"
            />
            <Faixa
              percent={Math.max(0, r.reparticao.sobrouPercent)}
              cor="bg-positive"
              titulo="Sobrou"
            />
          </div>

          <ul className="mt-3 space-y-1.5 text-xs">
            <Legenda
              cor="bg-primary"
              rotulo="Necessidades"
              valor={r.reparticao.necessidadesCents}
              percent={r.reparticao.necessidadesPercent}
              alvo={50}
            />
            <Legenda
              cor="bg-warning"
              rotulo="Não essenciais"
              valor={r.reparticao.desejosCents}
              percent={r.reparticao.desejosPercent}
              alvo={30}
            />
            <Legenda
              cor="bg-positive"
              rotulo="Sobrou"
              valor={r.reparticao.sobrouCents}
              percent={r.reparticao.sobrouPercent}
              alvo={20}
            />
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            {r.reparticao.comentario}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            A divisão entre essencial e não essencial é um ponto de partida
            baseado no nome da categoria, não uma verdade. Se discordar, tem
            razão — é a sua vida, não a regra.
          </p>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted">
        <Link href="/analise" className="font-medium text-primary hover:underline">
          Ver a análise completa →
        </Link>
      </p>
    </div>
  );
}

function Faixa({
  percent,
  cor,
  titulo,
}: {
  percent: number;
  cor: string;
  titulo: string;
}) {
  if (percent <= 0) return null;
  return (
    <span
      className={cor}
      style={{ width: `${Math.min(100, percent)}%` }}
      title={`${titulo}: ${percent}%`}
    />
  );
}

function Legenda({
  cor,
  rotulo,
  valor,
  percent,
  alvo,
}: {
  cor: string;
  rotulo: string;
  valor: number;
  percent: number;
  alvo: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${cor}`} />
      <span className="flex-1 text-muted">{rotulo}</span>
      <span className="tabular text-ink">{formatCents(valor)}</span>
      <span className="tabular w-20 text-right text-faint">
        {percent}% <span className="text-[10px]">(de {alvo}%)</span>
      </span>
    </li>
  );
}
