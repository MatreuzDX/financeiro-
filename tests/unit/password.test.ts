/**
 * Regras da palavra-passe.
 *
 * Existem porque a regra anterior (12 caracteres + "misture três de quatro
 * tipos") impediu o próprio dono da app de criar a sua conta. Estes testes
 * fixam o equilíbrio: exigente com o previsível, tolerante com o que uma
 * pessoa consegue decorar.
 */

import { describe, expect, it } from "vitest";
import { checkPasswordStrength } from "@/server/auth/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

const aceita = (p: string) => checkPasswordStrength(p).length === 0;

describe("força da palavra-passe", () => {
  it("o mínimo são 8 caracteres", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(aceita("1234567")).toBe(false);
    expect(checkPasswordStrength("curta")[0]).toMatch(/pelo menos 8/);
  });

  it("NÃO exige símbolos nem maiúsculas", () => {
    // As regras de composição levam a `Palavra1!` — previsível para uma
    // máquina e chato para a pessoa. O comprimento e a lista de comuns
    // fazem mais.
    expect(aceita("mateus55")).toBe(true);
    expect(aceita("casaverde")).toBe(true);
    expect(aceita("a-frase-que-eu-decoro")).toBe(true);
  });

  it("recusa as demasiado comuns, por muito longas que sejam", () => {
    expect(aceita("password")).toBe(false);
    expect(aceita("password123456")).toBe(false);
    expect(aceita("administrador")).toBe(false);
    expect(aceita("12345678")).toBe(false);
    expect(aceita("financeiro2026")).toBe(false);
  });

  it("recusa o mesmo carácter repetido", () => {
    expect(aceita("aaaaaaaaaa")).toBe(false);
  });

  it("recusa as absurdamente longas", () => {
    expect(aceita("a1".repeat(150))).toBe(false);
  });

  it("diz quantos caracteres faltam, em vez de só recusar", () => {
    const problemas = checkPasswordStrength("abc");
    expect(problemas[0]).toContain("tem 3");
  });
});
