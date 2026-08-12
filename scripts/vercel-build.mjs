/**
 * Build de produção na Vercel.
 *
 * Faz três coisas, por esta ordem:
 *   1. descobre a ligação à base de dados, seja qual for o nome que a
 *      integração lhe deu
 *   2. aplica as migrações — ANTES do build, para a coluna nova existir antes
 *      do código que a lê
 *   3. constrói a aplicação
 *
 * Se não houver base de dados, pára já com uma mensagem que se percebe, em
 * vez de um erro do Prisma no meio de mil linhas de log.
 */

import { spawnSync } from "node:child_process";

/** Cópia da lista em `src/lib/env.ts`. Se mexeres numa, mexe na outra. */
const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

const line = "─".repeat(64);

function findDatabaseUrl() {
  for (const name of CANDIDATES) {
    const value = process.env[name];
    if (value && value.trim() !== "") return { name, value };
  }
  return null;
}

const found = findDatabaseUrl();

if (!found) {
  console.error(`\n${line}`);
  console.error("  Falta a ligação à base de dados.");
  console.error(line);
  console.error("  A aplicação precisa de PostgreSQL para arrancar.");
  console.error("");
  console.error("  Na Vercel, no projeto:");
  console.error("    Storage → Create Database → Neon → plano gratuito");
  console.error("");
  console.error("  A variável é adicionada automaticamente. Depois:");
  console.error("    Deployments → ⋯ no mais recente → Redeploy");
  console.error("");
  console.error(`  Procurei por: ${CANDIDATES.join(", ")}`);
  console.error(`${line}\n`);
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//.test(found.value)) {
  console.error(
    `\n${found.name} não parece uma ligação PostgreSQL ` +
      `(começa por "${found.value.slice(0, 12)}…").\n`,
  );
  process.exit(1);
}

console.log(`Base de dados encontrada em ${found.name}.`);

// O Prisma só conhece DATABASE_URL. Normalizamos aqui, uma vez, para os
// comandos seguintes.
const env = { ...process.env, DATABASE_URL: found.value };

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nFalhou: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
