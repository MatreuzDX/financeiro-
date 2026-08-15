import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/guard";
import {
  AGREGADO,
  FIXED_QUESTIONS,
  HABITACAO,
  needsSetup,
  PERFIS,
} from "@/server/setup";
import { SetupWizard } from "./setup-wizard";

export const metadata: Metadata = { title: "Começar" };

export default async function ComecarPage({
  searchParams,
}: {
  searchParams: Promise<{ rever?: string }>;
}) {
  const session = await requireSession("/comecar");
  const params = await searchParams;

  // Já há contas criadas? Então isto já foi feito. Deixa-se entrar à mesma
  // com `?rever=1`, para quem quiser voltar a passar pelas perguntas — mas
  // nunca por acidente, que seria confuso.
  if (!(await needsSetup(session.workspaceId)) && !params.rever) {
    redirect("/");
  }

  const primeiroNome = session.name.split(" ")[0] || session.name;

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Bem-vindo, {primeiroNome}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Algumas perguntas e a app fica a fazer sentido no primeiro ecrã. As
          perguntas mudam conforme as suas respostas — e pode saltar qualquer
          uma.
        </p>
      </header>

      <SetupWizard
        perguntasFixas={FIXED_QUESTIONS}
        perfis={PERFIS}
        habitacoes={HABITACAO}
        agregados={AGREGADO}
        nome={primeiroNome}
      />
    </div>
  );
}
