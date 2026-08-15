import { TerminalSquare } from "lucide-react";
import { devLoginPermitido } from "@/server/auth/dev-login";
import { devLoginAction } from "./actions";

/**
 * Atalho de entrada para desenvolvimento.
 *
 * Não se renderiza fora de localhost — mas isso é só conveniência. A
 * barreira a sério está na ação, no servidor: `devLogin()` recusa se
 * `NODE_ENV` não for "development" ou se a variável `VERCEL` existir.
 *
 * É um <form> com Server Action, sem JavaScript de cliente nenhum: nada
 * disto vai parar ao pacote que o browser descarrega em produção.
 */
export function DevLoginButton() {
  if (!devLoginPermitido()) return null;

  return (
    <div className="mt-5 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <TerminalSquare size={13} aria-hidden />
        Só em localhost
      </p>
      <form action={devLoginAction}>
        <button
          type="submit"
          className="h-10 w-full rounded-xl border border-line-strong bg-surface text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
        >
          Entrar como administrador
        </button>
      </form>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        Entra na primeira conta de proprietário que existir. Se não houver
        nenhuma, cria uma de desenvolvimento. Este botão não existe em
        produção — e a própria ação recusa correr fora de localhost.
      </p>
    </div>
  );
}
