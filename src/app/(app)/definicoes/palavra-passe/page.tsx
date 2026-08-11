import type { Metadata } from "next";
import { requireSessionRaw } from "@/server/auth/guard";
import { Card, InfoNote, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Palavra-passe" };

export default async function PalavraPassePage({
  searchParams,
}: {
  searchParams: Promise<{ obrigatorio?: string }>;
}) {
  // Variante "raw": esta é a única página que uma conta com troca de
  // palavra-passe obrigatória consegue abrir.
  const session = await requireSessionRaw();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        title="Palavra-passe"
        description={session.email}
      />

      {params.obrigatorio || session.mustChangePassword ? (
        <InfoNote>
          Esta conta foi criada com uma palavra-passe gerada automaticamente.
          Antes de continuar, defina uma que só você conheça.
        </InfoNote>
      ) : null}

      <Card>
        <PasswordForm />
      </Card>

      <p className="text-[11px] leading-relaxed text-faint">
        Alterar a palavra-passe fecha todas as outras sessões. Se desconfia que
        alguém entrou na sua conta, é isto que a expulsa.
      </p>
    </div>
  );
}
