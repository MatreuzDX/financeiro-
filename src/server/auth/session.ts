/**
 * Sessões.
 *
 * O cookie transporta um token aleatório de 32 bytes. A base guarda apenas o
 * SHA-256 desse token — quem conseguir ler a base de dados não consegue
 * passar por ninguém.
 *
 * Nada de JWT: um token opaco com estado no servidor permite REVOGAR. Mudar
 * a palavra-passe fecha as sessões todas de imediato, o que um JWT não sabe
 * fazer sem uma lista de revogação (que é... estado no servidor).
 */

import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { randomToken } from "./password";

export const SESSION_COOKIE = "fin_session";

const SESSION_DAYS = 30;
/** Só se escreve na base se a última visita foi há mais de isto. */
const TOUCH_AFTER_MS = 6 * 60 * 60 * 1000;

export type SessionUser = {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  workspaceId: string;
  workspaceName: string;
  currency: string;
  timezone: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** IP nunca é guardado em claro — só um hash, para detetar padrões. */
export function hashIp(ip: string | null): string | null {
  return ip ? sha256(ip).slice(0, 32) : null;
}

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ipHash: hashIp(meta.ip ?? null),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // o JavaScript da página nunca lhe toca
    sameSite: "lax", // bloqueia CSRF vindo de outro site
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Lê a sessão atual. Devolve `null` se não houver, se tiver expirado, ou se
 * o utilizador já não existir.
 *
 * NOTA: não pode ser chamada de um Server Component que precise de ALTERAR
 * o cookie — os Server Components não podem escrever cookies. Por isso o
 * "touch" é tolerante a falhar.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: { workspace: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const user = session.user;
  const membership =
    user.memberships.find((m) => m.workspaceId === user.activeWorkspaceId) ??
    user.memberships[0];

  if (!membership) return null; // utilizador sem workspace: nada a mostrar

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: membership.role,
    mustChangePassword: user.mustChangePassword,
    theme: user.theme,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    currency: membership.workspace.currency,
    timezone: membership.workspace.timezone,
  };
}

export async function destroySession(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

/**
 * Fecha TODAS as sessões de um utilizador.
 *
 * Isto não é um extra: quem muda a palavra-passe por desconfiar que lhe
 * entraram na conta tem de conseguir expulsar quem lá está. Faz parte da
 * operação de mudar a palavra-passe, não é uma opção à parte.
 */
export async function destroyAllSessions(userId: string, exceptId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
}

/** Limpeza de sessões expiradas. Chamada oportunista, barata. */
export async function pruneExpiredSessions() {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}
