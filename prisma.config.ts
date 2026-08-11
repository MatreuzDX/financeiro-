import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * O helper `env()` da Prisma REBENTA quando a variável não existe — e o
 * ficheiro de configuração é lido em TODOS os comandos, incluindo o
 * `prisma generate` que corre no `postinstall` e que não precisa de base de
 * dados nenhuma.
 *
 * Na Vercel, isso fazia o `npm install` falhar antes sequer de haver build:
 *   PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL
 *
 * Aqui lê-se diretamente, com fallback vazio. Quem precisa mesmo da ligação
 * — `migrate deploy` — falha depois, com uma mensagem que se percebe (ver
 * `scripts/require-database-url.mjs`).
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
