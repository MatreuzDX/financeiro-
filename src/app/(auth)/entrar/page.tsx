import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { hasAnyUser } from "@/server/onboarding";
import { Card, SuccessBanner } from "@/components/ui";
import { DevLoginButton } from "../dev-login-button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ seguinte?: string; redefinida?: string }>;
}) {
  // Aplicação acabada de instalar, ainda sem contas: não faz sentido mostrar
  // um login que ninguém consegue passar.
  if (!(await hasAnyUser())) redirect("/instalar");

  // Quem já tem sessão VÁLIDA não precisa de ver isto. A verificação é feita
  // aqui, e não no proxy, porque aqui é possível perguntar à base de dados se
  // a sessão presta — ver o comentário em `src/proxy.ts`.
  if (await getSession()) redirect("/");

  const params = await searchParams;

  return (
    <Card className="animate-rise">
      {params.redefinida ? (
        <div className="mb-4">
          <SuccessBanner>
            Palavra-passe alterada. Já pode entrar com a nova.
          </SuccessBanner>
        </div>
      ) : null}

      <LoginForm next={params.seguinte ?? ""} />

      <p className="mt-5 text-center text-xs text-muted">
        <Link href="/recuperar" className="text-primary hover:underline">
          Esqueci-me da palavra-passe
        </Link>
      </p>

      <DevLoginButton />
    </Card>
  );
}
