import type { Metadata } from "next";
import Link from "next/link";
import { Card, InfoNote } from "@/components/ui";
import { isEmailDeliveryConfigured } from "@/server/auth/service";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar palavra-passe" };

export default function RecuperarPage() {
  const emailConfigured = isEmailDeliveryConfigured();
  const isDev = process.env.NODE_ENV === "development";

  return (
    <Card className="animate-rise">
      <h2 className="text-sm font-semibold text-ink">Recuperar acesso</h2>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-muted">
        Escreva o email da sua conta. Por segurança, a resposta é a mesma
        exista ou não uma conta com esse endereço.
      </p>

      {/*
        Honestidade: sem serviço de email configurado, esta página NÃO pode
        prometer que enviou uma mensagem. Diz o que se passa e dá o caminho
        que existe mesmo.
      */}
      {!emailConfigured && !isDev ? (
        <div className="space-y-3">
          <InfoNote>
            O envio de emails ainda não está configurado neste sistema, por
            isso não é possível receber o link por email. Quem administra o
            servidor pode definir uma palavra-passe nova com o comando{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              npm run reset-password -- o-seu@email.com
            </code>
          </InfoNote>
        </div>
      ) : (
        <>
          {!emailConfigured ? (
            <div className="mb-4">
              <InfoNote>
                Em desenvolvimento não se envia email: o link aparece no
                terminal onde o servidor está a correr.
              </InfoNote>
            </div>
          ) : null}
          <RecoverForm />
        </>
      )}

      <p className="mt-5 text-center text-xs text-muted">
        <Link href="/entrar" className="text-primary hover:underline">
          Voltar ao início de sessão
        </Link>
      </p>
    </Card>
  );
}
