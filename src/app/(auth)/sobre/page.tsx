import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Gauge,
  Receipt,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Financeiro — saber quanto sobra mesmo",
  description:
    "Gestão de dinheiro pessoal e profissional feita para Portugal. Separa o que é seu do que é do Estado, importa o extrato do banco e diz quanto ganha mesmo por hora.",
};

/**
 * A porta da rua.
 *
 * Até aqui, o link da app levava direto a um ecrã de login: quem chegasse
 * sem conta via uma caixa de palavra-passe e ia embora. Esta página existe
 * para explicar o que isto é antes de pedir seja o que for.
 *
 * Não promete nada que a app não faça. Cada afirmação aqui tem uma página
 * atrás dela.
 */
export default async function SobrePage() {
  // Se ainda não há ninguém instalado, o botão leva à instalação em vez de
  // levar a um login onde ninguém consegue entrar.
  const contas = await prisma.user.count().catch(() => 1);
  const primeiraVez = contas === 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-5 py-10">
      <header className="space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Feito para Portugal
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          Saber quanto sobra <span className="text-primary">mesmo</span>
        </h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted">
          A maior parte das apps de dinheiro diz-lhe quanto tem na conta. Esta
          diz-lhe quanto daquilo é seu — depois dos impostos, do combustível e
          do que já está prometido a outra pessoa.
        </p>
        <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
          <Link
            href={primeiraVez ? "/instalar" : "/entrar"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90 sm:w-auto"
          >
            {primeiraVez ? "Criar a primeira conta" : "Entrar"}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </header>

      {/* ── O problema ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">O extrato mente</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Quem trabalha a recibos verdes fatura €2 000, vê €2 000 na conta e
          gasta €2 000. Em janeiro chega a nota da Segurança Social e a conta
          não bate certo. Não é falta de disciplina — é que parte daquele saldo
          já tinha dono e nada o dizia.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nenhuma das apps grandes resolve isto. O YNAB, o Monarch e o Copilot
          são todos americanos: não sabem o que é um recibo verde, nem que a
          Segurança Social se paga de três em três meses sobre 70% do faturado,
          nem que o primeiro ano é isento.
        </p>
      </section>

      {/* ── O que faz ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">O que faz</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Bloco
            Icon={Receipt}
            titulo="Separa o que não é seu"
            texto="IVA, Segurança Social e IRS calculados a cada recibo, com as datas de pagamento e a conta à vista para poder conferir."
          />
          <Bloco
            Icon={Upload}
            titulo="Importa o extrato do banco"
            texto="CSV de qualquer banco português, com pré-visualização, deteção de repetidos e regras que categorizam sozinhas."
          />
          <Bloco
            Icon={Gauge}
            titulo="Diz quanto ganha por hora"
            texto="A sério: depois do combustível, do desgaste do veículo e dos impostos. Para quem faz entregas, é o número que ninguém calcula."
          />
          <Bloco
            Icon={Users}
            titulo="Serve um casal ou uma equipa"
            texto="Vários espaços, convites por link, e cada movimento mostra quem o registou. Uma conta só."
          />
          <Bloco
            Icon={Sparkles}
            titulo="Responde a perguntas"
            texto="Em português, sobre os seus números. Vai à base de dados buscá-los antes de responder — e quando não há dados, diz que não há."
          />
          <Bloco
            Icon={Check}
            titulo="Encontra o que paga sempre"
            texto="Subscrições, cobranças fora do costume, e quantos meses aguenta se a receita parar amanhã."
          />
        </ul>
      </section>

      {/* ── O que não faz ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface-2 p-5">
        <h2 className="text-base font-semibold text-ink">O que não faz</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Vale a pena dizer isto antes de alguém perder tempo:
        </p>
        <ul className="mt-2.5 space-y-1.5 text-sm text-muted">
          <li>
            <strong className="text-ink">Não liga ao seu banco.</strong> Não há
            sincronização automática. Importa-se o extrato à mão, uma vez por
            mês, e leva dois minutos.
          </li>
          <li>
            <strong className="text-ink">Não dá conselhos de investimento.</strong>{" "}
            Nem lhe diz onde pôr dinheiro.
          </li>
          <li>
            <strong className="text-ink">Não substitui um contabilista.</strong>{" "}
            As contas de impostos são estimativas com as regras públicas, e a
            app diz isso em cada ecrã.
          </li>
          <li>
            <strong className="text-ink">Não vende os seus dados.</strong> Não há
            publicidade, nem rastreadores, nem parceiros.
          </li>
        </ul>
      </section>

      {/* ── Confiança ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          Porque é que pode confiar nos números
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Por baixo, isto é um livro de <strong className="text-ink">partidas
          dobradas</strong> a sério, como o de uma contabilidade: cada movimento
          tem linhas que somam zero, e a própria base de dados recusa gravar se
          não somarem. É o que impede uma transferência entre contas de aparecer
          como lucro.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Todo o dinheiro é guardado em <strong className="text-ink">cêntimos
          inteiros</strong>, nunca em vírgula flutuante. Nenhum erro de
          arredondamento é possível.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          E pode <strong className="text-ink">levar tudo consigo</strong> a
          qualquer momento: um ficheiro com todos os seus dados, sem pedir
          licença a ninguém.
        </p>
      </section>

      <footer className="space-y-3 border-t border-line pt-6 text-center">
        <Link
          href={primeiraVez ? "/instalar" : "/entrar"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
        >
          {primeiraVez ? "Começar" : "Entrar"}
          <ArrowRight size={16} aria-hidden />
        </Link>
        <p className="text-[11px] text-faint">
          Em euros e em português de Portugal. Instala-se no telemóvel como uma
          app normal.
        </p>
      </footer>
    </div>
  );
}

function Bloco({
  Icon,
  titulo,
  texto,
}: {
  Icon: typeof Check;
  titulo: string;
  texto: string;
}) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <Icon size={18} className="text-primary" aria-hidden />
      <h3 className="mt-2 text-sm font-medium text-ink">{titulo}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{texto}</p>
    </li>
  );
}
