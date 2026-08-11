/**
 * Rate limiting contra força bruta.
 *
 * O contador vive na BASE DE DADOS, não em memória. A Vercel é serverless:
 * cada pedido pode cair num processo diferente, e um `Map` em memória
 * esqueceria as tentativas anteriores — dando ao atacante tentativas
 * ilimitadas com um limitador que parece estar a funcionar.
 *
 * Duas chaves independentes por tentativa de login:
 *   • o email  → protege uma conta específica
 *   • o IP     → protege contra varrer muitas contas a partir do mesmo sítio
 */

import "server-only";
import { prisma } from "@/server/db";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type Rule = { limit: number; windowMs: number; blockMs: number };

export const LOGIN_RULE: Rule = {
  limit: 5,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};

export const RESET_RULE: Rule = {
  limit: 3,
  windowMs: 60 * 60_000,
  blockMs: 60 * 60_000,
};

/** Verifica sem consumir. Usar antes de gastar tempo a verificar um hash. */
export async function checkRateLimit(
  key: string,
  rule: Rule = LOGIN_RULE,
): Promise<RateLimitResult> {
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!row) return { allowed: true };

  const now = Date.now();
  if (row.blockedUntil && row.blockedUntil.getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - now) / 1000),
    };
  }
  if (now - row.windowStart.getTime() > rule.windowMs) return { allowed: true };
  if (row.count < rule.limit) return { allowed: true };

  return { allowed: false, retryAfterSeconds: Math.ceil(rule.blockMs / 1000) };
}

/** Regista uma tentativa falhada e bloqueia se passar do limite. */
export async function registerFailure(
  key: string,
  rule: Rule = LOGIN_RULE,
): Promise<void> {
  const now = new Date();
  const row = await prisma.loginAttempt.findUnique({ where: { key } });

  if (!row || now.getTime() - row.windowStart.getTime() > rule.windowMs) {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now, blockedUntil: null },
      update: { count: 1, windowStart: now, blockedUntil: null },
    });
    return;
  }

  const count = row.count + 1;
  await prisma.loginAttempt.update({
    where: { key },
    data: {
      count,
      blockedUntil:
        count >= rule.limit ? new Date(now.getTime() + rule.blockMs) : null,
    },
  });
}

/** Sucesso limpa o contador dessa chave. */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

export function describeRetry(seconds: number): string {
  if (seconds < 60) return "Tente novamente dentro de menos de um minuto.";
  const minutes = Math.ceil(seconds / 60);
  return `Tente novamente dentro de ${minutes} minuto${minutes === 1 ? "" : "s"}.`;
}
