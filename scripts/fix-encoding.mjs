/**
 * O `initdb` do Windows cria o cluster com locale WIN1252. A base de dados é
 * criada em UTF8 (ver dev-db.mjs), mas as sessões novas herdam
 * `client_encoding = WIN1252` do cluster — e o motor de migrações do Prisma
 * (Rust) não o corrige sozinho, ao contrário do driver `pg` do Node.
 *
 * Resultado: qualquer carácter fora do Latin-1 (─, €, emoji) rebenta com
 * "has no equivalent in encoding WIN1252".
 *
 * Isto fixa o encoding ao nível da BASE DE DADOS, para todas as sessões.
 * Só é preciso correr uma vez, e só em desenvolvimento no Windows.
 */
import { Client } from "pg";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/financeiro";
const dbName = new URL(url).pathname.slice(1);

const admin = new Client(url.replace(/\/[^/]+$/, "/postgres"));
await admin.connect();
await admin.query(`ALTER DATABASE "${dbName}" SET client_encoding TO 'UTF8'`);
await admin.end();

const check = new Client(url);
await check.connect();
const { rows } = await check.query("SHOW client_encoding");
console.log(`client_encoding em "${dbName}": ${rows[0].client_encoding}`);
await check.end();
