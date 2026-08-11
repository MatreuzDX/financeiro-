"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  ErrorBanner,
  MoneyInput,
  SuccessBanner,
} from "@/components/ui";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { saveBudgetAction, type BudgetState } from "./actions";

type Line = {
  categoryId: string;
  name: string;
  color: string | null;
  plannedCents: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Guardar orçamento"}
    </Button>
  );
}

export function BudgetForm({
  month,
  monthLabel,
  lines,
}: {
  month: string;
  monthLabel: string;
  lines: Line[];
}) {
  const [state, action] = useActionState<BudgetState, FormData>(
    saveBudgetAction,
    {},
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.categoryId,
        l.plannedCents > 0 ? (l.plannedCents / 100).toFixed(2).replace(".", ",") : "",
      ]),
    ),
  );

  const total = Object.values(values).reduce(
    (sum, raw) => sum + (raw.trim() ? (parseAmountToCents(raw) ?? 0) : 0),
    0,
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="month" value={month} />

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <div className="rounded-2xl border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">{monthLabel}</p>
          <p className="tabular text-sm font-semibold text-ink">
            {formatCents(total)}
          </p>
        </div>

        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <li
              key={line.categoryId}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: line.color ?? "var(--muted)" }}
                aria-hidden
              />
              <label
                htmlFor={`cat-${line.categoryId}`}
                className="min-w-0 flex-1 truncate text-sm text-ink"
              >
                {line.name}
              </label>
              <div className="w-32 shrink-0">
                <MoneyInput
                  id={`cat-${line.categoryId}`}
                  name={`cat:${line.categoryId}`}
                  value={values[line.categoryId] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [line.categoryId]: e.target.value,
                    }))
                  }
                  className="h-9 text-sm"
                  aria-label={`Orçamento para ${line.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        Categorias deixadas vazias não entram no orçamento. Um limite de €0,00
        diria &ldquo;não posso gastar nada&rdquo;, que é diferente de &ldquo;não
        orçamentei isto&rdquo;.
      </p>

      <SubmitButton />
    </form>
  );
}
