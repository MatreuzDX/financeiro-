import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { requireSessionRaw } from "@/server/auth/guard";
import { BottomNav, Sidebar } from "@/components/nav";
import { RegistoRapido } from "@/components/registo-rapido";
import { ThemeSwitcher } from "@/components/theme";
import { isThemeChoice, THEME_COOKIE } from "@/lib/theme";
import { categoriasMaisUsadas } from "@/server/categories";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segunda barreira: o proxy só viu que existe um cookie; aqui confirma-se
  // contra a base de dados que a sessão é mesmo válida.
  //
  // Usa-se a variante "raw" — sem o desvio para trocar a palavra-passe
  // obrigatória. Esse desvio é feito por cada página; se fosse feito aqui, a
  // própria página de trocar a palavra-passe entrava num ciclo infinito de
  // redirecionamentos.
  const session = await requireSessionRaw();

  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  const theme = isThemeChoice(raw) ? raw : "system";

  // As categorias de despesa mais usadas, para o registo rápido. Ordenadas
  // pelo que a pessoa mais gasta, não por ordem alfabética: as três primeiras
  // resolvem quase sempre, e assim o toque certo está sempre à vista.
  const categorias = await categoriasMaisUsadas(session.workspaceId);

  return (
    <div className="flex min-h-dvh">
      <Sidebar workspaceName={session.workspaceName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:h-16 lg:px-6">
          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate text-sm font-semibold text-ink">
              Financeiro
            </p>
            <p className="truncate text-[11px] text-muted">{session.name}</p>
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm text-muted">
              Olá, <span className="font-medium text-ink">{session.name}</span>
            </p>
          </div>

          <ThemeSwitcher current={theme} />

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              aria-label="Sair"
              className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <LogOut size={17} aria-hidden />
            </button>
          </form>
        </header>

        {/* pb-24 dá espaço à barra de navegação fixa do telemóvel. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 lg:px-6 lg:pb-8">
          {children}
        </main>
      </div>

      {categorias.length > 0 ? <RegistoRapido categorias={categorias} /> : null}

      <BottomNav />
    </div>
  );
}
