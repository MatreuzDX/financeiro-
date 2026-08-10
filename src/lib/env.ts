/**
 * Validação das variáveis de ambiente.
 *
 * A aplicação recusa arrancar se faltar alguma coisa essencial. É melhor
 * falhar no arranque, com uma mensagem clara, do que descobrir a meio de um
 * login em produção que o SESSION_SECRET estava vazio.
 *
 * Este ficheiro NUNCA pode ser importado por um Client Component.
 */

import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL em falta — copie .env.example para .env"),
  SESSION_SECRET: z
    .string()
    .min(
      32,
      "SESSION_SECRET tem de ter pelo menos 32 caracteres. Gerar com: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    ),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

let cached: z.infer<typeof schema> | null = null;

export function env(): z.infer<typeof schema> {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
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
