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

/**
 * As migrações, com paciência.
 *
 * BUG REAL, apanhado em produção: dois commits empurrados com 35 segundos de
 * intervalo geraram dois builds em paralelo. O primeiro estava a aplicar uma
 * migração e tinha o bloqueio consultivo do Postgres; o segundo esperou os
 * 10 segundos que o Prisma tolera, desistiu com `P1002` e o build foi abaixo.
 *
 *   Timed out trying to acquire a postgres advisory lock. Timeout: 10000ms.
 *
 * Não era erro de código nem da base de dados — era só dois builds ao mesmo
 * tempo, coisa que acontece sempre que se empurra duas vezes seguidas. E o
 * resultado era um deploy vermelho por uma razão que se resolve esperando.
 *
 * Por isso: até três tentativas, com esperas crescentes. Só o bloqueio é
 * repetido — uma migração que falha porque o SQL está mal continua a parar o
 * build à primeira, que é como deve ser.
 */
function migrar() {
  const esperas = [0, 15, 40];

  for (let tentativa = 0; tentativa < esperas.length; tentativa++) {
    if (esperas[tentativa] > 0) {
      console.log(
        `\nOutro build deve estar a migrar. A esperar ${esperas[tentativa]}s ` +
          `antes de tentar outra vez (${tentativa + 1}/${esperas.length})…`,
      );
      // Espera bloqueante de propósito: isto é um script de build, não há
      // nada em paralelo para fazer entretanto.
      spawnSync(process.execPath, [
        "-e",
        `setTimeout(()=>{}, ${esperas[tentativa] * 1000})`,
      ]);
    }

    console.log("\n> npx prisma migrate deploy");
    const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      encoding: "utf8",
      env,
      shell: process.platform === "win32",
    });

    // O output não é herdado para se poder inspecionar; imprime-se à mão para
    // o log da Vercel continuar a mostrar tudo.
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);

    if (r.status === 0) return;

    const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const eBloqueio = saida.includes("P1002") || saida.includes("advisory lock");
    if (!eBloqueio) {
      console.error("\nA migração falhou por uma razão que não é o bloqueio.");
      process.exit(r.status ?? 1);
    }
  }

  console.error(
    `\n${line}\n  Não foi possível aplicar as migrações.\n${line}\n` +
      "  Outro build ficou com o bloqueio das migrações e não o largou.\n" +
      "  Faça Redeploy deste commit — quase sempre resolve à segunda.\n" +
      `${line}\n`,
  );
  process.exit(1);
}

migrar();
run("npx", ["next", "build"]);
