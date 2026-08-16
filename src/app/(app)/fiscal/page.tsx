import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, PiggyBank, ShieldCheck } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { panoramaFiscal } from "@/server/fiscal";
import { TAXAS } from "@/lib/fiscal";
import { formatCents } from "@/lib/money";
import { formatLong } from "@/lib/date";
import { Card, CardHeader, InfoNote, PageHeader } from "@/components/ui";
import { FiscalForm } from "./fiscal-form";

export const metadata: Metadata = { title: "Impostos" };

export default async function FiscalPage() {
  const session = await requireSession("/fiscal");
  const p = await panoramaFiscal(session.workspaceId, session.timezone);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Impostos"
        description="O dinheiro que está na conta e não é seu"
      />

      {p.perfil.independente ? (
        <>
          {/* ── O número que a página existe para dar ─────────────────── */}
          <Card className="p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted">
              Do seu saldo, é mesmo seu
            </p>
            <p className="tabular mt-1 text-3xl font-semibold text-ink">
              {formatCents(p.mesmoSeuCents)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Tem {formatCents(p.saldoTotalCents)} nas contas, mas{" "}
              <strong className="text-ink">
                {formatCents(p.reservaAno.guardarCents)}
              </strong>{" "}
              já têm dono: são impostos e contribuições do que faturou este ano.
            </p>
          </Card>

          {p.reservaAno.guardarCents > 0 ? (
            <Card>
              <CardHeader
                title="De onde vem esse valor"
                hint={`Sobre ${formatCents(p.faturadoAnoCents)} faturados este ano`}
              />
              <ul className="divide-y divide-line">
                {p.reservaAno.parcelas.map((parcela) => (
                  <li key={parcela.chave} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-ink">{parcela.titulo}</span>
                      <span className="tabular text-sm font-medium text-ink">
                        {formatCents(parcela.cents)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{parcela.conta}</p>
                    <p className="text-[11px] text-faint">{parcela.quando}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* ── Trimestre em curso ────────────────────────────────────── */}
          <Card>
            <CardHeader
              title={`Trimestre de ${p.trimestreLabel}`}
              hint="É sobre este período que vai declarar a seguir"
            />
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Faturado"
                valor={formatCents(p.faturadoTrimestreCents)}
              />
              <Stat
                label="A guardar"
                valor={formatCents(p.reservaTrimestre.guardarCents)}
                destaque
              />
            </div>
          </Card>

          {/* ── Avisos ────────────────────────────────────────────────── */}
          {p.isentoSs ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-positive/30 bg-positive-soft px-3 py-2.5">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden />
              <p className="text-xs leading-relaxed text-ink">
                {p.reservaAno.avisos.find((a) => a.includes("isento"))}
              </p>
            </div>
          ) : null}

          {p.perfil.regimeIva === "ISENTO_ART53" ? (
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                p.iva.vaiUltrapassar
                  ? "border-warning/40 bg-warning-soft"
                  : "border-line bg-surface-2"
              }`}
            >
              {p.iva.vaiUltrapassar ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
              ) : (
                <PiggyBank size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              )}
              <div className="text-xs leading-relaxed">
                <p className="text-ink">
                  Vai em {formatCents(p.faturadoAnoCents)} de{" "}
                  {formatCents(TAXAS.iva.limiteIsencaoArt53Cents)} —{" "}
                  {p.iva.percentagemDoLimite}% do limite da isenção de IVA.
                </p>
                {p.iva.vaiUltrapassar ? (
                  <p className="mt-1 text-muted">
                    A este ritmo fecha o ano em{" "}
                    <strong className="text-ink">
                      {formatCents(p.iva.projecaoCents)}
                    </strong>{" "}
                    e passa a ter de cobrar IVA. Vale a pena falar com o
                    contabilista antes de lá chegar, não depois.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── Calendário ────────────────────────────────────────────── */}
          {p.calendario.length > 0 ? (
            <Card>
              <CardHeader
                title="O que aí vem"
                hint="As datas que costumam apanhar toda a gente de surpresa"
              />
              <ul className="divide-y divide-line">
                {p.calendario.map((o) => (
                  <li key={`${o.titulo}-${o.data}`} className="flex gap-3 py-2.5">
                    <CalendarClock
                      size={15}
                      className="mt-0.5 shrink-0 text-muted"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {o.titulo}
                        {o.periodo ? (
                          <span className="text-muted"> · {o.periodo}</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-faint">
                        até {formatLong(o.data)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{o.descricao}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-ink">
            Porque é que isto existe
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Quem trabalha a recibos verdes fatura €2 000, vê €2 000 na conta e
            gasta €2 000 — e em janeiro chega a nota da Segurança Social. Não é
            falta de disciplina: é que <strong>o extrato mente</strong>. Parte
            daquele saldo já tem dono.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Ligue a opção abaixo e a app passa a dizer, a cada momento, quanto
            do seu saldo é mesmo seu.
          </p>
        </Card>
      )}

      <FiscalForm perfil={p.perfil} />

      <InfoNote>
        <strong>Isto não é aconselhamento fiscal.</strong> São estimativas com
        as regras públicas de 2026, e a app mostra sempre a conta que fez para a
        poder conferir. As taxas estão todas editáveis. Para decisões que
        contam, fale com um contabilista.
      </InfoNote>

      <p className="text-[11px] text-faint">
        Taxas atualizadas em {formatLong(TAXAS.atualizadoEm)}. Fontes: Guia
        Fiscal 2026 da PwC Portugal, Segurança Social, Código do IVA (art. 53.º)
        e Código do IRS (art. 101.º e 151.º).{" "}
        <Link href="/analise" className="font-medium text-primary hover:underline">
          Ver a análise dos seus números →
        </Link>
      </p>
    </div>
  );
}

function Stat({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p
        className={`tabular mt-0.5 text-base font-semibold ${
          destaque ? "text-warning" : "text-ink"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
