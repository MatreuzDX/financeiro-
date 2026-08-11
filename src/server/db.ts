/**
 * Cliente Prisma (singleton).
 *
 * Prisma 7 usa driver adapters: a ligação é feita pelo `@prisma/adapter-pg`,
 * não pela `url` do schema. Em desenvolvimento o cliente é guardado em
 * `globalThis` para sobreviver ao hot reload — sem isso cada recarga abre um
 * pool novo e a base esgota as ligações em poucos minutos.
 */

import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/** Tipo do cliente dentro de uma transação. Os serviços recebem isto. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
