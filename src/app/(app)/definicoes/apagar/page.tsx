import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/guard";
import { PageHeader } from "@/components/ui";
import { ApagarForm } from "./apagar-form";

export const metadata: Metadata = { title: "Apagar a conta" };

export default async function ApagarPage() {
  await requireSession("/definicoes/apagar");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Apagar a conta"
        description="Sem lixeira, sem período de graça, sem forma de voltar atrás"
      />

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">O que desaparece</h2>
        <ul className="space-y-1 text-xs leading-relaxed text-muted">
          <li>Todos os movimentos, contas, categorias e orçamentos</li>
          <li>Os veículos, abastecimentos e trabalhos</li>
          <li>As metas, recorrências e regras de categorização</li>
          <li>O registo de atividade</li>
          <li>A sua conta de utilizador e todas as sessões abertas</li>
        </ul>
        <p className="text-xs leading-relaxed text-muted">
          Espaços partilhados com outras pessoas <strong>não</strong> são
          apagados — teria de sair deles primeiro. Apagar a sua conta não pode
          apagar as contas de mais ninguém.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
        <h2 className="text-sm font-semibold text-primary">
          Leve os dados antes
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-primary/80">
          Depois de apagar não há como recuperar nada — nem por mim, nem por
          ninguém. Descarregue primeiro, mesmo que ache que não vai precisar.
        </p>
        <a
          href="/api/export/tudo"
          className="mt-2.5 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-fg"
        >
          Descarregar tudo
        </a>
      </div>

      <ApagarForm />

      <p className="text-center text-xs text-muted">
        <Link href="/definicoes" className="font-medium text-primary hover:underline">
          Afinal não — voltar às definições
        </Link>
      </p>
    </div>
  );
}
