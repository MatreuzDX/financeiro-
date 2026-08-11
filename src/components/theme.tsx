"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { htmlClassForTheme, type ThemeChoice } from "@/lib/theme";
import { setTheme } from "@/app/actions/theme";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

/**
 * Alternador de tema.
 *
 * Aplica a classe no <html> imediatamente (para a mudança ser instantânea) e
 * grava a preferência num cookie através de uma Server Action, para o
 * servidor já servir o tema certo no próximo carregamento.
 */
export function ThemeSwitcher({ current }: { current: ThemeChoice }) {
  const [pending, startTransition] = useTransition();

  function choose(value: ThemeChoice) {
    // Aplica já no browser, para a mudança ser instantânea…
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    const next = htmlClassForTheme(value);
    if (next) root.classList.add(next);
    // …e grava no servidor, para o próximo carregamento já vir certo.
    startTransition(() => {
      void setTheme(value);
    });
  }

  return (
    <div
      className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5"
      role="group"
      aria-label="Tema"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          disabled={pending}
          aria-pressed={current === value}
          title={label}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium transition-colors",
            current === value
              ? "bg-surface text-ink shadow-[var(--shadow)]"
              : "text-muted hover:text-ink",
          )}
        >
          <Icon size={14} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
