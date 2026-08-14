/**
 * Palavras-passe.
 *
 * Argon2id com os parâmetros recomendados pela OWASP (19 MiB, 2 iterações,
 * paralelismo 1). O hash nunca sai desta camada: quem chama recebe um
 * booleano, nunca a cadeia.
 */

import "server-only";
import { hash, verify, type Algorithm } from "@node-rs/argon2";
import { randomBytes, randomInt } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

/**
 * `Algorithm` é um const enum e o TypeScript com `isolatedModules` não deixa
 * lê-lo em tempo de execução. O valor 2 é `Argon2id` — escrito assim de
 * propósito, com o tipo aplicado, para continuar a ser explícito.
 */
const ARGON2ID = 2 as Algorithm;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Mínimo de 8 caracteres, sem regras de composição.
 *
 * Estava em 12 + "misture três de quatro tipos". Impediu o próprio dono da
 * app de criar a sua conta, e não é sequer o que as boas práticas atuais
 * recomendam: as regras de composição levam as pessoas a escolher
 * `Palavra1!` — previsível para uma máquina, chato para a pessoa.
 *
 * O que fica a proteger, que vale mais:
 *   • comprimento mínimo
 *   • lista de palavras-passe demasiado comuns
 *   • rate limiting: 5 tentativas por 15 minutos, por email E por IP
 *   • argon2id, que torna cada tentativa cara
 *
 * Ver `rate-limit.ts` — é essa a defesa a sério contra força bruta.
 */
export { MIN_PASSWORD_LENGTH };

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Nunca deixa escapar a razão de falhar. Um hash corrompido na base devolve
 * `false`, tal como uma palavra-passe errada — quem tenta entrar não fica a
 * saber a diferença.
 */
export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Palavras-passe demasiado comuns para servirem, seja qual for o tamanho.
 * Lista curta de propósito: apanha o previsível sem dar a ilusão de ser
 * uma verificação séria contra dicionários.
 */
const COMMON = [
  "password",
  "palavrapasse",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "admin",
  "administrador",
  "welcome",
  "benvindo",
  "iloveyou",
  "letmein",
  "abc123",
  "senha",
  "financeiro",
  "dinheiro",
];

export type PasswordProblem = string;

/** Devolve a lista de problemas. Vazia = aceitável. */
export function checkPasswordStrength(plain: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (plain.length < MIN_PASSWORD_LENGTH) {
    problems.push(
      `Precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres (tem ${plain.length}).`,
    );
  }
  if (plain.length > 200) {
    problems.push("Demasiado longa (máximo 200 caracteres).");
  }
  const lower = plain.toLowerCase();
  if (COMMON.some((c) => lower === c || lower.startsWith(c))) {
    problems.push("É uma palavra-passe demasiado comum. Escolha outra.");
  }
  if (/^(.)\1+$/.test(plain)) {
    problems.push("Não pode ser o mesmo carácter repetido.");
  }
  return problems;
}


/**
 * Palavra-passe inicial do administrador.
 *
 * 22 caracteres de um alfabeto de 70 → ~135 bits de entropia. Sem caracteres
 * ambíguos (0/O, 1/l/I) porque isto vai ser lido de um ecrã e escrito à mão.
 * `randomInt` usa o gerador criptográfico do sistema, não `Math.random`.
 */
export function generateStrongPassword(length = 22): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_#$%&@";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  // Garante que passa nas próprias regras; a probabilidade de falhar é
  // ínfima, mas "ínfima" não é "nunca".
  if (checkPasswordStrength(out).length > 0) return generateStrongPassword(length);
  return out;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
