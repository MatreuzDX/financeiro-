"use server";

import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { getSession } from "@/server/auth/session";
import { isThemeChoice, THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

/**
 * Grava a preferência de tema.
 *
 * No cookie (para o servidor já servir o tema certo no próximo pedido) e,
 * se houver sessão, também no perfil — assim a preferência acompanha a
 * pessoa noutro dispositivo.
 */
export async function setTheme(choice: ThemeChoice) {
  if (!isThemeChoice(choice)) return;

  const store = await cookies();
  store.set(THEME_COOKIE, choice, {
    httpOnly: false, // não é segredo; o próprio ecrã revela o tema
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const session = await getSession();
  if (session) {
    await prisma.user
      .update({
        where: { id: session.userId },
        data: {
          theme:
            choice === "light" ? "LIGHT" : choice === "dark" ? "DARK" : "SYSTEM",
        },
      })
      .catch(() => {});
  }
}
