import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { SESSION_COOKIE } from "@/lib/auth-cookie";

function request(path: string, withCookie: boolean) {
  const req = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (withCookie) req.cookies.set(SESSION_COOKIE, "um-token-qualquer");
  return req;
}

function locationOf(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  it("manda para o login quem não tem cookie nenhum", () => {
    const response = proxy(request("/movimentos", false));
    expect(locationOf(response)).toBe("/entrar");
  });

  it("guarda o destino para voltar lá depois de entrar", () => {
    const response = proxy(request("/veiculos", false));
    const location = response.headers.get("location")!;
    expect(new URL(location).searchParams.get("seguinte")).toBe("/veiculos");
  });

  it("deixa passar as páginas públicas sem sessão", () => {
    for (const path of ["/entrar", "/recuperar", "/redefinir"]) {
      expect(locationOf(proxy(request(path, false)))).toBeNull();
    }
  });

  it("deixa passar quem tem cookie", () => {
    expect(locationOf(proxy(request("/movimentos", true)))).toBeNull();
  });

  it("NÃO desvia /entrar quando existe cookie", () => {
    // Regressão: um cookie que existe mas já não é válido punha a app em
    // ciclo infinito — `/` mandava para `/entrar` (sessão inválida) e o proxy
    // mandava de volta para `/` (cookie existe). Ninguém conseguia entrar.
    //
    // O proxy corre no edge e não sabe se a sessão vale; por isso não pode
    // decidir isto. Quem decide é a página `/entrar`.
    expect(locationOf(proxy(request("/entrar", true)))).toBeNull();
  });

  it("compara por segmento, não por prefixo de texto", () => {
    // "/entrada" começa por "/entrar" mas é outra rota: tem de ser protegida.
    expect(locationOf(proxy(request("/entrada", false)))).toBe("/entrar");
    // "/recuperar/algo" é mesmo um subcaminho da rota pública.
    expect(locationOf(proxy(request("/recuperar/algo", false)))).toBeNull();
  });
});
