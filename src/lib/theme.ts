/**
 * Constantes do tema, num módulo NEUTRO — sem `"use client"` e sem
 * `server-only`.
 *
 * PORQUÊ UM FICHEIRO SÓ PARA ISTO (bug real, apanhado a usar a app):
 * o nome do cookie estava exportado do componente `theme.tsx`, que é
 * `"use client"`. Quando o servidor importa qualquer coisa de um módulo de
 * cliente, o Next substitui-a por uma referência que LANÇA se for chamada.
 *
 * Resultado: `cookies().set(THEME_COOKIE, …)` tentava usar como NOME do
 * cookie o texto da função-stub, o cabeçalho ficava inválido, a Server Action
 * respondia 500 — e a preferência de tema nunca era guardada. Nada disto
 * aparecia no ecrã: o tema mudava à vista (isso é feito no browser) e voltava
 * atrás no recarregamento seguinte.
 *
 * Valores partilhados entre servidor e cliente vivem aqui.
 */

export const THEME_COOKIE = "fin_theme";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_CHOICES: ThemeChoice[] = ["light", "dark", "system"];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === "string" &&
    (THEME_CHOICES as readonly string[]).includes(value)
  );
}

/** Classe a pôr no <html>. Vazia = segue o sistema operativo. */
export function htmlClassForTheme(choice: ThemeChoice): string {
  if (choice === "light") return "theme-light";
  if (choice === "dark") return "theme-dark";
  return "";
}
