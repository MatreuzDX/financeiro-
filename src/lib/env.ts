/**
 * Validação das variáveis de ambiente.
 *
 * A aplicação recusa arrancar se faltar o essencial. É melhor falhar no
 * arranque, com uma mensagem clara, do que descobrir a meio de um login em
 * produção que faltava configuração.
 *
 * Este ficheiro NUNCA pode ser importado por um Client Component.
 *
 * NOTA sobre o `SESSION_SECRET`: existiu aqui como obrigatório e foi
 * removido, porque não era usado por nada. As sessões são tokens aleatórios
 * de 32 bytes guardados na base como SHA-256 — não há cookie assinado, logo
 * não há segredo de assinatura. Exigir uma variável que ninguém lê só
 * complica o deploy e dá uma falsa sensação de segurança. Se um dia houver
 * cookies assinados ou CSRF com token, volta — e aí será mesmo preciso.
 */

import "server-only";
import { z } from "zod";

/**
 * Nomes possíveis para a ligação à base de dados, por ordem de preferência.
 *
 * As integrações da Vercel (Neon, Supabase, Prisma Postgres) não usam todas
 * o mesmo nome. Aceitar os vários poupa a quem faz o deploy ter de andar a
 * copiar valores entre variáveis.
 *
 * Há uma cópia desta lista em `scripts/vercel-build.mjs`, que corre fora do
 * bundle da aplicação. Se mexeres numa, mexe na outra.
 */
const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

function findDatabaseUrl(): string | undefined {
  for (const name of DATABASE_URL_CANDIDATES) {
    const value = process.env[name];
    if (value && value.trim() !== "") return value;
  }
  return undefined;
}

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "Falta a ligação à base de dados. Em desenvolvimento: copie .env.example para .env e corra `npm run db:start`. Na Vercel: Storage → Create Database → Neon.",
    ),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  // Preenchidas pela Vercel automaticamente.
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

let cached: z.infer<typeof schema> | null = null;

export function env(): z.infer<typeof schema> {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    DATABASE_URL: findDatabaseUrl(),
  });
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuração inválida:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Endereço público da aplicação, para os links que saem daqui (recuperação
 * de palavra-passe).
 *
 * Em produção a Vercel preenche `VERCEL_PROJECT_PRODUCTION_URL` — usa-se
 * essa em vez de `VERCEL_URL`, que muda a cada deploy e daria links a apontar
 * para deployments antigos que ninguém deve usar.
 */
export function appUrl(): string {
  const e = env();
  if (e.NEXT_PUBLIC_APP_URL) return e.NEXT_PUBLIC_APP_URL;
  if (e.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}
