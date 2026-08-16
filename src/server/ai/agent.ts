/**
 * O assistente.
 *
 * Responde a perguntas sobre o dinheiro da própria pessoa, em português, e
 * escolhe o gráfico que melhor mostra a resposta.
 *
 * TRÊS COISAS QUE ESTE FICHEIRO GARANTE
 *
 * 1. **Não inventa.** O modelo não recebe nenhum número no pedido inicial.
 *    Recebe ferramentas e tem de as usar. Se não houver dados, a ferramenta
 *    diz que não há, e o modelo tem instrução explícita para o repetir em vez
 *    de estimar.
 *
 * 2. **Não parte sem chave de API.** Sem `ANTHROPIC_API_KEY`, a app não fica
 *    com um ecrã partido: responde com as regras locais que já existem na
 *    `/analise` e diz claramente que o assistente completo está desligado.
 *    Uma funcionalidade que exige uma variável de ambiente para a app arrancar
 *    é uma funcionalidade mal construída.
 *
 * 3. **Tem tecto.** Uma API paga sem limite é uma fatura surpresa. Conta-se o
 *    uso por espaço e por mês, e recusa-se antes de gastar, não depois.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { executarFerramenta, FERRAMENTAS, type Grafico } from "@/server/ai/tools";
import { analisar } from "@/server/insights";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

/** Perguntas por espaço e por mês. Generoso para uso pessoal, longe de doer. */
export const LIMITE_MENSAL = 150;

/** Quantas idas ao modelo antes de desistir. Cada volta é uma chamada paga. */
const MAX_VOLTAS = 6;

const MODELO = "claude-sonnet-5";

export type Resposta = {
  texto: string;
  grafico?: Grafico;
  /** Verdadeiro quando respondeu sem modelo, só com as regras locais. */
  local: boolean;
  usadas: number;
  limite: number;
};

export function assistenteLigado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const INSTRUCOES = `És o assistente de uma aplicação portuguesa de finanças pessoais.
Falas português europeu, na segunda pessoa ("você"), de forma directa e curta.

REGRAS QUE NÃO PODES QUEBRAR:

1. NUNCA inventes um número. Todos os valores que disseres têm de vir de uma
   ferramenta que chamaste nesta conversa. Se não tens o número, chama a
   ferramenta. Se a ferramenta disser que não há dados, diz que não há dados —
   não estimes, não compares com "a média das pessoas", não arredondes de
   cabeça.

2. Chama sempre a ferramenta "hoje" antes de calcular qualquer período. Não
   assumas a data.

3. Responde em 3 a 6 frases. Esta app é usada no telemóvel. Se a resposta
   precisar de uma lista, usa no máximo 5 pontos.

4. Quando a resposta tiver números, escolhe a ferramenta que devolve o gráfico
   certo: círculo para "para onde foi o dinheiro", linha para evolução ao
   longo do tempo, barras para comparar contas. Não peças gráficos a mais —
   um por resposta chega.

5. Não dás conselhos de investimento nem dizes a ninguém onde pôr dinheiro.
   Podes explicar conceitos e apontar padrões nos gastos da própria pessoa.

6. Sobre impostos: usa a ferramenta "impostos" e repete que são estimativas.
   Nunca digas a alguém que não tem de pagar uma coisa.

7. Termina com uma sugestão concreta e pequena, quando fizer sentido. Nada de
   "considere reduzir os seus gastos" — isso não ajuda ninguém.`;

async function usoDoMes(workspaceId: string, mes: string) {
  const linha = await prisma.aiUsage.findUnique({
    where: { workspaceId_month: { workspaceId, month: mes } },
  });
  return linha?.perguntas ?? 0;
}

export async function perguntar(
  session: SessionUser,
  pergunta: string,
  historico: { papel: "pessoa" | "assistente"; texto: string }[] = [],
): Promise<Resposta> {
  const mes = todayIso(session.timezone).slice(0, 7);
  const usadas = await usoDoMes(session.workspaceId, mes);

  if (!assistenteLigado()) {
    return {
      ...(await respostaLocal(session)),
      local: true,
      usadas,
      limite: LIMITE_MENSAL,
    };
  }

  if (usadas >= LIMITE_MENSAL) {
    return {
      texto:
        `Chegou às ${LIMITE_MENSAL} perguntas deste mês. O limite existe para ` +
        `a conta da API não crescer sem ninguém dar por isso — recomeça no dia 1. ` +
        `Entretanto, a página de Análise continua a funcionar e não gasta nada.`,
      local: true,
      usadas,
      limite: LIMITE_MENSAL,
    };
  }

  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const mensagens: Anthropic.MessageParam[] = [
    ...historico.slice(-6).map((h) => ({
      role: (h.papel === "pessoa" ? "user" : "assistant") as "user" | "assistant",
      content: h.texto,
    })),
    { role: "user", content: pergunta },
  ];

  let grafico: Grafico | undefined;
  let entrada = 0;
  let saida = 0;

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resposta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 1200,
        system: INSTRUCOES,
        tools: FERRAMENTAS,
        messages: mensagens,
      });

      entrada += resposta.usage.input_tokens;
      saida += resposta.usage.output_tokens;

      const pedidos = resposta.content.filter((b) => b.type === "tool_use");

      if (pedidos.length === 0) {
        const texto = resposta.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();

        await registarUso(session, mes, entrada, saida, pergunta);
        return {
          texto: texto || "Não consegui responder a isso. Tente pôr de outra maneira.",
          grafico,
          local: false,
          usadas: usadas + 1,
          limite: LIMITE_MENSAL,
        };
      }

      mensagens.push({ role: "assistant", content: resposta.content });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const pedido of pedidos) {
        // O workspaceId vem da sessão, nunca do que o modelo pediu.
        const r = await executarFerramenta(
          session,
          pedido.name,
          (pedido.input ?? {}) as Record<string, unknown>,
        ).catch((erro: unknown) => ({
          texto: `A ferramenta falhou: ${erro instanceof Error ? erro.message : "erro"}`,
        }));

        if ("grafico" in r && r.grafico) grafico = r.grafico;
        resultados.push({
          type: "tool_result",
          tool_use_id: pedido.id,
          content: r.texto,
        });
      }
      mensagens.push({ role: "user", content: resultados });
    }

    await registarUso(session, mes, entrada, saida, pergunta);
    return {
      texto:
        "Dei muitas voltas e não cheguei lá. Tente uma pergunta mais concreta — " +
        "por exemplo, com um período: «quanto gastei em agosto?».",
      grafico,
      local: false,
      usadas: usadas + 1,
      limite: LIMITE_MENSAL,
    };
  } catch (erro) {
    console.error("[assistente]", erro);
    // Uma falha da API não pode deixar a pessoa sem resposta nenhuma.
    const local = await respostaLocal(session);
    return {
      texto:
        `O assistente não respondeu (${
          erro instanceof Error ? erro.message : "erro desconhecido"
        }). Fica o que consigo dizer sem ele:\n\n${local.texto}`,
      grafico: local.grafico,
      local: true,
      usadas,
      limite: LIMITE_MENSAL,
    };
  }
}

async function registarUso(
  session: SessionUser,
  mes: string,
  entrada: number,
  saida: number,
  pergunta: string,
): Promise<void> {
  await prisma.aiUsage
    .upsert({
      where: { workspaceId_month: { workspaceId: session.workspaceId, month: mes } },
      create: {
        workspaceId: session.workspaceId,
        month: mes,
        perguntas: 1,
        tokensEntrada: entrada,
        tokensSaida: saida,
      },
      update: {
        perguntas: { increment: 1 },
        tokensEntrada: { increment: entrada },
        tokensSaida: { increment: saida },
      },
    })
    .catch(() => {});

  // A pergunta em si NÃO vai para a auditoria: é informação pessoal e o
  // registo é permanente. Fica só o comprimento, que chega para perceber uso.
  await recordAudit({
    action: "ai.question",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { caracteres: pergunta.length, tokensEntrada: entrada, tokensSaida: saida },
  });
}

/**
 * A resposta sem modelo nenhum.
 *
 * Não tenta imitar uma conversa: diz o que consegue dizer com as regras da
 * página de Análise, que são reais e não custam nada. É pouco, e diz que é
 * pouco — melhor do que fingir.
 */
async function respostaLocal(
  session: SessionUser,
): Promise<{ texto: string; grafico?: Grafico }> {
  const hoje = todayIso(session.timezone);
  const periodo = resolvePeriod({ periodo: "mes", today: hoje });
  const analise = await analisar(session.workspaceId, periodo, session.timezone).catch(
    () => null,
  );
  const insights = analise?.insights ?? [];

  if (insights.length === 0) {
    return {
      texto:
        "O assistente com inteligência artificial está desligado nesta " +
        "instalação — falta a chave da API. Sem ele, também não tenho ainda " +
        "observações a fazer: registe alguns movimentos e volte aqui.",
    };
  }

  const top = insights.slice(0, 3);
  return {
    texto:
      "O assistente com inteligência artificial está desligado nesta " +
      "instalação, por isso não consigo responder à pergunta em si. O que " +
      "consigo dizer sobre os seus números, sem ele:\n\n" +
      top.map((i) => `**${i.titulo}** — ${i.observacao} ${i.porque}`).join("\n\n"),
  };
}
