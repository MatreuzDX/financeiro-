import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, InfoNote } from "@/components/ui";
import { hasAnyUser } from "@/server/onboarding";
import { InstallForm } from "./install-form";

export const metadata: Metadata = { title: "Primeira conta" };

/**
 * Instalação inicial.
 *
 * Existe para não ser preciso abrir um terminal contra a base de produção só
 * para ter por onde entrar. Assim que houver uma conta, esta página deixa de
 * existir na prática — manda para o login.
 */
export default async function InstalarPage() {
  if (await hasAnyUser()) redirect("/entrar");

  return (
    <Card className="animate-rise">
      <h2 className="text-sm font-semibold text-ink">Criar a sua conta</h2>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-muted">
        Esta aplicação ainda não tem nenhuma conta. A primeira a ser criada
        fica como proprietária.
      </p>

      <InstallForm />

      <div className="mt-4">
        <InfoNote>
          Depois desta, esta página fecha-se: mais ninguém consegue criar uma
          conta por aqui. Escolha uma palavra-passe de que se lembre — a
          recuperação por email ainda não está configurada.
        </InfoNote>
      </div>
    </Card>
  );
}
