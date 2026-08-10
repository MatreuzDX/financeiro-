/**
 * Postgres local para desenvolvimento, sem Docker e sem direitos de
 * administrador.
 *
 * Usa `embedded-postgres`, que traz os binários oficiais do PostgreSQL como
 * dependência npm e os corre a partir de `.pgdata/`.
 *
 *   node scripts/dev-db.mjs start   → arranca e fica a correr
 *   node scripts/dev-db.mjs stop    → pára
 *   node scripts/dev-db.mjs reset   → pára e apaga tudo
 *
 * Em produção usa-se Postgres alojado (Neon/Supabase); isto é só para
 * desenvolver e testar.
 */

import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, ".pgdata");

export const DB_CONFIG = {
  user: "postgres",
  password: "postgres",
  // 5434: a 5432 é a do sistema (se existir) e a 5433 é do projeto ayaha-crm.
  port: 5434,
  database: "financeiro",
};

export const DATABASE_URL = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@localhost:${DB_CONFIG.port}/${DB_CONFIG.database}`;

function createInstance() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    port: DB_CONFIG.port,
    persistent: true,
  });
}

async function start() {
  const pg = createInstance();
  const firstRun = !existsSync(DATA_DIR);

  if (firstRun) {
    console.log("A inicializar o cluster em .pgdata …");
    await pg.initialise();
  }

  await pg.start();
  console.log(`Postgres a correr em localhost:${DB_CONFIG.port}`);

  // A base TEM de ser UTF8. Em Windows o `initdb` herda WIN1252 do sistema e
  // `createDatabase` copiaria essa codificação — o que rebenta no primeiro
  // acento. Criamos à mão a partir de template0, o único que permite mudar
  // de codificação.
  const { Client } = await import("pg");
  const admin = new Client({
    host: "localhost",
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: "postgres",
  });
  await admin.connect();
  const { rowCount } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [DB_CONFIG.database],
  );
  if (rowCount === 0) {
    await admin.query(
      `CREATE DATABASE "${DB_CONFIG.database}" ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    console.log(`Base de dados "${DB_CONFIG.database}" criada em UTF8.`);
  } else {
    console.log(`Base de dados "${DB_CONFIG.database}" já existia.`);
  }
  await admin.end();

  console.log(`\nDATABASE_URL="${DATABASE_URL}"\n`);

  const shutdown = async () => {
    console.log("\nA parar o Postgres…");
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  setInterval(() => {}, 1 << 30);
}

async function stop() {
  const pg = createInstance();
  await pg.stop().catch(() => {});
  console.log("Postgres parado.");
}

async function reset() {
  await stop();
  if (existsSync(DATA_DIR)) {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(".pgdata apagado.");
  }
}

const command = process.argv[2] ?? "start";
if (command === "start") await start();
else if (command === "stop") await stop();
else if (command === "reset") await reset();
else {
  console.error(`Comando desconhecido: ${command}. Use start | stop | reset.`);
  process.exit(1);
}
