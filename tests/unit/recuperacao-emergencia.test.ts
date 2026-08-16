/**
 * A porta de emergência.
 *
 * Existe para quem esquece a palavra-passe numa instalação sem serviço de
 * email. O portão NÃO é saber o email — é conseguir definir variáveis de
 * ambiente no servidor. Estes testes fixam isso: se um dia a comparação
 * deixar de ser exata, qualquer pessoa que saiba o email da conta passava a
 * pedir um link de reposição.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { emergencyRecoveryEmail } from "@/server/auth/service";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("recuperação de emergência", () => {
  it("está DESLIGADA por omissão", () => {
    // O estado normal de uma app em produção. Se isto alguma vez devolver um
    // email sem a variável estar definida, a porta ficou aberta sozinha.
    vi.stubEnv("RECOVERY_EMAIL", "");
    expect(emergencyRecoveryEmail()).toBeNull();
  });

  it("normaliza espaços e maiúsculas", () => {
    vi.stubEnv("RECOVERY_EMAIL", "  Dono@Exemplo.LOCAL  ");
    expect(emergencyRecoveryEmail()).toBe("dono@exemplo.local");
  });

  it("uma variável só com espaços não liga nada", () => {
    vi.stubEnv("RECOVERY_EMAIL", "   ");
    expect(emergencyRecoveryEmail()).toBeNull();
  });

  it("abre para o email configurado e para mais nenhum", () => {
    vi.stubEnv("RECOVERY_EMAIL", "dono@exemplo.local");
    const alvo = emergencyRecoveryEmail();
    expect(alvo).toBe("dono@exemplo.local");
    expect(alvo).not.toBe("intruso@exemplo.local");
    // Nem sequer para um endereço parecido.
    expect(alvo).not.toBe("dono@exemplo.local.pt");
  });
});
