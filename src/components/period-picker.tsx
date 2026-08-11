"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/cn";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/period";

/**
 * Seletor de período.
 *
 * O período vive na URL, não em estado do React. Assim o botão "voltar"
 * funciona, um link partilhado mostra exatamente o mesmo, e o servidor pode
 * calcular tudo antes de a página chegar ao browser.
 */
export function PeriodPicker({
  current,
  from,
  to,
}: {
  current: PeriodKey;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showCustom, setShowCustom] = useState(current === "personalizado");

  function apply(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    // Mudar de período recomeça a paginação.
    query.delete("pagina");
    startTransition(() => {
      router.push(`${pathname}?${query.toString()}`, { scroll: false });
    });
  }

  return (
    <div className={cn("space-y-2", pending && "opacity-70")}>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIOD_KEYS.filter((k) => k !== "personalizado").map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setShowCustom(false);
              apply({ periodo: key, de: null, ate: null });
            }}
            aria-pressed={current === key}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              current === key
                ? "border-primary bg-primary-soft text-primary"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          aria-pressed={current === "personalizado"}
          aria-expanded={showCustom}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            current === "personalizado"
              ? "border-primary bg-primary-soft text-primary"
              : "border-line bg-surface text-muted hover:text-ink",
          )}
        >
          <CalendarRange size={13} aria-hidden />
          Personalizado
        </button>
      </div>

      {showCustom ? (
        <div className="animate-fade flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            <span className="mb-1 block">De</span>
            <input
              type="date"
              defaultValue={from}
              max={to}
              onChange={(e) =>
                apply({ periodo: "personalizado", de: e.target.value, ate: to })
              }
              className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            <span className="mb-1 block">Até</span>
            <input
              type="date"
              defaultValue={to}
              min={from}
              onChange={(e) =>
                apply({ periodo: "personalizado", de: from, ate: e.target.value })
              }
              className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
