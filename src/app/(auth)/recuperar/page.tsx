import type { Metadata } from "next";
import Link from "next/link";
import { Card, InfoNote } from "@/components/ui";
import {
  emergencyRecoveryEmail,
  isEmailDeliveryConfigured,
} from "@/server/auth/service";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar palavra-passe" };

export default function RecuperarPage() {
  const emailConfigured = isEmailDeliveryConfigured();
  const isDev = process.env.NODE_ENV === "development";
  // Com a recuperação de emergência ligada há caminho, e o formulário tem de
  // aparecer mesmo sem serviço de email configurado.
  const emergencia = emergencyRecoveryEmail() !== null;

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
      {!emailConfigured && !isDev && !emergencia ? (
        <div className="space-y-3">
          <InfoNote>
            O envio de emails ainda não está configurado neste sistema, por
            isso não é possível receber o link por email.
          </InfoNote>
          <InfoNote>
            <strong>Para recuperar o acesso:</strong> nas definições do
            servidor (na Vercel: Settings → Environment Variables), crie a
            variável{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              RECOVERY_EMAIL
            </code>{" "}
            com o email da sua conta e faça um novo deploy. Volte aqui e o link
            aparece no ecrã. Apague a variável depois de entrar.
          </InfoNote>
          <InfoNote>
            Com acesso ao terminal do servidor, também serve{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              npm run reset-password -- o-seu@email.com
            </code>
          </InfoNote>
        </div>
      ) : (
        <>
          {emergencia ? (
            <div className="mb-4">
              <InfoNote>
                A recuperação de emergência está ligada. Escreva o email
                configurado e o link aparece aqui mesmo, sem passar por
                nenhuma caixa de correio.
              </InfoNote>
            </div>
          ) : !emailConfigured ? (
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
