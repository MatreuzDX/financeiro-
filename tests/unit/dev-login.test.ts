/**
 * A porta de desenvolvimento tem de estar FECHADA em todo o lado menos em
 * localhost.
 *
 * Este é o tipo de coisa que se escreve uma vez e nunca mais se pensa nela —
 * e é exatamente por isso que precisa de teste. Um dia alguém mexe no
 * `NODE_ENV` do build, ou copia este ficheiro para outro projeto, e a porta
 * fica aberta sem ninguém dar por isso.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { devLoginPermitido } from "@/server/auth/dev-login";

/**
 * `process.env` não aceita `Object.defineProperty` — só descritores de dados
 * completos. O `vi.stubEnv` do Vitest existe precisamente para isto e repõe
 * tudo no fim.
 */
function definirAmbiente(nodeEnv: string | undefined, vercel?: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("VERCEL", vercel);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("entrada rápida de desenvolvimento", () => {
  it("abre em desenvolvimento local", () => {
    definirAmbiente("development");
    expect(devLoginPermitido()).toBe(true);
  });

  it("FECHA em produção", () => {
    definirAmbiente("production");
    expect(devLoginPermitido()).toBe(false);
  });

  it("FECHA em testes", () => {
    definirAmbiente("test");
    expect(devLoginPermitido()).toBe(false);
  });

  it("FECHA na Vercel, mesmo que NODE_ENV diga development", () => {
    // A Vercel define VERCEL=1 em produção E em pré-visualizações. É a
    // segunda tranca: se um dia um build de preview correr com
    // NODE_ENV=development, isto continua fechado.
    definirAmbiente("development", "1");
    expect(devLoginPermitido()).toBe(false);
  });

  it("FECHA se NODE_ENV não estiver definida", () => {
    definirAmbiente(undefined);
    expect(devLoginPermitido()).toBe(false);
  });
});
