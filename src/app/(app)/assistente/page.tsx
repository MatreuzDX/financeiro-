import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/guard";
import { assistenteLigado, LIMITE_MENSAL } from "@/server/ai/agent";
import { sugestoes } from "@/server/ai/tools";
import { InfoNote, PageHeader } from "@/components/ui";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Assistente" };

export default async function AssistentePage() {
  const session = await requireSession("/assistente");
  const ligado = assistenteLigado();
  const perguntas = await sugestoes(session);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assistente"
        description="Pergunte em português sobre o seu dinheiro"
      />

      {!ligado ? (
        <InfoNote>
          <strong>O assistente está desligado nesta instalação.</strong> Falta a
          variável <code>ANTHROPIC_API_KEY</code>. Sem ela, a app continua a
          funcionar toda — só esta página é que responde com as regras da{" "}
          <Link href="/analise" className="font-medium underline">
            Análise
          </Link>{" "}
          em vez de conversar. Para ligar: na Vercel, Settings → Environment
          Variables → <code>ANTHROPIC_API_KEY</code>, e um redeploy.
        </InfoNote>
      ) : null}

      <Chat sugestoes={perguntas} ligado={ligado} />

      <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Como é que isto funciona</h2>
        <p className="text-xs leading-relaxed text-muted">
          O assistente <strong>não sabe nenhum número de cor</strong>. Quando
          pergunta alguma coisa, ele vai à base de dados buscar exatamente o que
          precisa — o resumo do mês, os gastos por categoria, os saldos — e só
          depois responde. É por isso que demora um segundo ou dois.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Se não houver dados para responder, diz que não há.{" "}
          <strong>Não estima, não compara consigo com «a média das pessoas»,
          não arredonda de cabeça.</strong> Numa app de dinheiro, um número
          inventado é pior do que uma resposta em falta.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Não dá conselhos de investimento nem lhe diz onde pôr dinheiro. Sobre
          impostos, usa as mesmas estimativas da página de Impostos e repete
          sempre que são estimativas.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Há um limite de <strong>{LIMITE_MENSAL} perguntas por mês</strong>,
          para a conta da API não crescer sem ninguém dar por isso. As suas
          perguntas não ficam guardadas — no registo de atividade fica só que
          houve uma pergunta e o tamanho dela.
        </p>
      </div>
    </div>
  );
}
