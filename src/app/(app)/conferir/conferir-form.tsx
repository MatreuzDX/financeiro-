"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2, ScanLine, TriangleAlert } from "lucide-react";
import { Button, ErrorBanner, Field, Input, MoneyInput, Select } from "@/components/ui";
import { Nota } from "@/components/visual";
import { formatCents } from "@/lib/money";
import { formatShort } from "@/lib/date";
import { conferirAction, type ConferirState } from "./actions";

type Conta = { id: string; nome: string; appCents: number };

function Conferir() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="pressao w-full">
      <ScanLine size={16} aria-hidden />
      {pending ? "A comparar…" : "Comparar com o banco"}
    </Button>
  );
}

export function ConferirForm({
  contas,
  hoje,
}: {
  contas: Conta[];
  hoje: string;
}) {
  const [state, action] = useActionState<ConferirState, FormData>(
    conferirAction,
    {},
  );
  const r = state.resultado;

  return (
    <div className="space-y-4">
      {r ? (
        <div
          className={`animate-rise rounded-2xl border p-5 text-center ${
            r.bate
              ? "border-positive/30 bg-positive-soft"
              : r.gravidade === "grande"
                ? "border-negative/30 bg-negative-soft"
                : "border-warning/40 bg-warning-soft"
          }`}
        >
          {r.bate ? (
            <CheckCircle2 size={28} className="mx-auto text-positive" aria-hidden />
          ) : (
            <TriangleAlert size={28} className="mx-auto text-warning" aria-hidden />
          )}

          <p className="figura mt-2 text-2xl text-ink">
            {r.bate ? "Bate certo" : formatCents(Math.abs(r.diferencaCents))}
          </p>
          {!r.bate ? (
            <p className="mt-0.5 text-xs text-muted">de diferença</p>
          ) : null}

          <div className="mx-auto mt-3 max-w-xs space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">O banco diz</span>
              <span className="tabular text-ink">{formatCents(r.bancoCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">A app diz</span>
              <span className="tabular text-ink">{formatCents(r.appCents)}</span>
            </div>
          </div>

          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted">
            {r.sugestao}
          </p>

          {r.suspeitos.length > 0 ? (
            <div className="mt-4 text-left">
              <p className="mb-1.5 text-xs font-medium text-ink">
                Estes movimentos têm exatamente esse valor
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {r.suspeitos.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-ink">
                        {s.description}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {formatShort(s.date)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-ink">
                      {formatCents(s.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Pode ser coincidência — mas quando um valor bate ao cêntimo, na
                maior parte das vezes é um destes lançado a dobrar ou com o
                sinal trocado.
              </p>
            </div>
          ) : null}

          {!r.bate ? (
            <Link
              href="/movimentos/novo"
              className="pressao mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              Registar o que falta
            </Link>
          ) : null}
        </div>
      ) : null}

      <form
        action={action}
        className="space-y-4 rounded-2xl border border-line bg-surface p-4"
        noValidate
      >
        {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

        <Field label="Que conta">
          <Select name="accountId" required defaultValue={contas[0]?.id}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — a app diz {formatCents(c.appCents)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Saldo que o banco mostra"
          hint="O saldo contabilístico do extrato, não o disponível — o disponível já desconta cativos"
        >
          <MoneyInput name="saldo" required inputMode="decimal" placeholder="1.234,56" />
        </Field>

        <Field
          label="À data de"
          hint="A data do saldo que copiou, não a de hoje se estiver a ver um extrato antigo"
        >
          <Input name="date" type="date" required defaultValue={hoje} max={hoje} />
        </Field>

        <Field label="Nota (opcional)">
          <Input name="notes" maxLength={200} placeholder="Ex.: falta o levantamento de sábado" />
        </Field>

        <Conferir />
      </form>

      <Nota tom="info">
        Conferir <strong>não corrige nada sozinho</strong> — só mostra a
        diferença e guarda a data. Corrigir automaticamente seria inventar um
        movimento que ninguém fez, e a partir daí os números deixavam de ser
        seus.
      </Nota>
    </div>
  );
}
