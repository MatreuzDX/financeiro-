import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

/**
 * Primeira barreira de acesso.
 *
 * Corre no edge e NÃO fala com a base de dados: só consegue ver se existe um
 * cookie, não se a sessão é válida. Por isso não é a única barreira — cada
 * página e cada Server Action volta a verificar no servidor
 * (`src/server/auth/guard.ts`).
 *
 * O que isto resolve é o caso comum: quem não tem sessão nenhuma nem chega a
 * carregar a página privada.
 */

const PUBLIC_PREFIXES = ["/entrar", "/recuperar", "/redefinir"];

/**
 * Comparação por SEGMENTO, não por prefixo de texto.
 *
 * BUG REAL num projeto anterior: `"/contas".startsWith("/conta")` é `true`,
 * e uma rota privada caiu na lista das públicas sem ninguém reparar.
 */
function matchesSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PREFIXES.some((p) => matchesSegment(pathname, p));

  if (!hasCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    // Guardar o destino para voltar lá depois de entrar.
    if (pathname !== "/") {
      url.searchParams.set("seguinte", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  // NÃO se faz aqui o desvio "já tem sessão → vai para o dashboard".
  //
  // BUG REAL, apanhado a usar a app: um cookie que existe mas já não é válido
  // (sessão apagada, expirada, base recriada) punha a app em ciclo infinito —
  // `/` via que a sessão não presta e mandava para `/entrar`, o proxy via que
  // havia cookie e mandava de volta para `/`, e a pessoa ficava sem forma
  // nenhuma de voltar a entrar.
  //
  // O proxy corre no edge e não fala com a base: só sabe se o cookie EXISTE,
  // não se VALE. Por isso não pode tomar decisões que dependam da validade.
  // Esse desvio vive agora na própria página `/entrar`, que consegue mesmo
  // verificar a sessão.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo menos ficheiros estáticos, imagens do Next e o favicon.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
