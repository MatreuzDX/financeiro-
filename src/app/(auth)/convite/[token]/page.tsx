import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { lerConvite } from "@/server/workspaces";
import { getSession } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { ROLE_EXPLICACAO } from "@/server/workspaces";
import { Card, ErrorBanner, InfoNote } from "@/components/ui";
import { JoinButton, RegisterAndJoinForm } from "./invite-forms";

export const metadata: Metadata = { title: "Convite" };

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [convite, session] = await Promise.all([lerConvite(token), getSession()]);

  if (!convite) {
    return (
      <Card className="animate-rise space-y-4">
        <ErrorBanner>
          Este convite já não é válido. Pode ter expirado, já ter sido usado, ou
          ter sido cancelado.
        </ErrorBanner>
        <p className="text-center text-xs text-muted">
          Peça um convite novo a quem o enviou, ou{" "}
          <Link href="/entrar" className="text-primary hover:underline">
            entre na sua conta
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="animate-rise space-y-4">
      <header className="text-center">
        <span
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"
          aria-hidden
        >
          <Users size={20} />
        </span>
        <h2 className="text-sm font-semibold text-ink">
          Foi convidado para {convite.workspaceName}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Vai entrar como <strong>{ROLE_LABELS[convite.role]}</strong> —{" "}
          {ROLE_EXPLICACAO[convite.role].toLowerCase()}.
        </p>
      </header>

      <InfoNote>
        Ao entrar, passa a ver <strong>tudo</strong> o que está neste espaço:
        saldos, movimentos e gráficos. E quem lá está passa a ver o que você
        registar.
      </InfoNote>

      {session ? (
        <>
          <p className="text-xs text-muted">
            Está com sessão como <strong className="text-ink">{session.email}</strong>.
          </p>
          <JoinButton token={token} espaco={convite.workspaceName} />
        </>
      ) : (
        <RegisterAndJoinForm token={token} email={convite.email} />
      )}

      {!session ? (
        <p className="text-center text-xs text-muted">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-primary hover:underline">
            Entre primeiro
          </Link>{" "}
          e abra este link outra vez.
        </p>
      ) : null}
    </Card>
  );
}
