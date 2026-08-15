/**
 * Análise: observações em linguagem simples sobre os números da própria
 * pessoa.
 *
 * É o que as apps do género têm em comum — a Copilot chama-lhe
 * "Intelligence", a Monarch mostra um feed de observações. A ideia é a
 * mesma e é boa: um gráfico mostra, uma frase EXPLICA. Estudos de 2026
 * apontam que a maior fonte de stress financeiro não é ganhar pouco, é não
 * perceber para onde vai o dinheiro.
 *
 * Cada observação tem três partes, e é isso que a torna didática:
 *   o que vi   →  o número, tirado dos dados reais
 *   porque importa  →  o que esse número significa na prática
 *   o que fazer     →  um passo concreto, com o caminho
 *
 * REGRAS:
 *  • Nenhum número é inventado nem estimado por analogia. Sai todo dos
 *    movimentos registados.
 *  • Sem dados suficientes, diz-se isso — nunca se preenche com zeros, que
 *    "gastaste 0 €" e "não registaste nada" são coisas diferentes.
 *  • Projeções vêm sempre rotuladas como tal, e explicam a conta que
 *    fizeram.
 */

import "server-only";
import type { Scope } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  getByCategory,
  getBudgetStatus,
  getSummary,
  getTotalBalance,
  getVehicleStats,
} from "@/server/reports";
import { listVehicles } from "@/server/vehicles";
import { diffDays, todayIso, type IsoDate } from "@/lib/date";
import {
  formatCents,
  formatCostPerKm,
  metresToKmString,
} from "@/lib/money";
import type { Period } from "@/lib/period";

export type Tom = "bom" | "neutro" | "atencao" | "mau";

export type Insight = {
  id: string;
  tom: Tom;
  titulo: string;
  /** O número, em linguagem de pessoa. */
  observacao: string;
  /** Porque é que isto importa — a parte que ensina. */
  porque: string;
  /** Um passo concreto. Opcional: nem toda a observação pede ação. */
  acao?: { texto: string; href: string };
};

export type Analise = {
  /** Um parágrafo que se lê como alguém a falar, não como um relatório. */
  resumo: string;
  insights: Insight[];
  /** Quando não há praticamente nada registado, dizemos porquê. */
  semDados: boolean;
};

function percentagem(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 100);
}

/** "mais 34%" / "menos 12%" / null quando não há base de comparação. */
function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export async function analisar(
  workspaceId: string,
  period: Period,
  timezone: string,
  scope?: Scope,
): Promise<Analise> {
  const hoje = todayIso(timezone) as IsoDate;
  const range = { from: period.from, to: period.to };

  const [
    resumoPeriodo,
    resumoAnterior,
    despesasPorCategoria,
    despesasAnterior,
    saldo,
    orcamento,
    veiculos,
    totalMovimentos,
    ultimoMovimento,
    transferencias,
  ] = await Promise.all([
    getSummary(workspaceId, range, scope),
    getSummary(workspaceId, period.previous, scope),
    getByCategory(workspaceId, range, "EXPENSE", scope),
    getByCategory(workspaceId, period.previous, "EXPENSE", scope),
    getTotalBalance(workspaceId),
    getBudgetStatus(workspaceId, hoje),
    listVehicles(workspaceId, true),
    prisma.transaction.count({
      where: { workspaceId, deletedAt: null, status: "CLEARED" },
    }),
    prisma.transaction.findFirst({
      where: { workspaceId, deletedAt: null, status: "CLEARED" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.transaction.count({
      where: {
        workspaceId,
        deletedAt: null,
        status: "CLEARED",
        type: "TRANSFER",
      },
    }),
  ]);

  const insights: Insight[] = [];

  // ── Ainda não há nada que analisar ───────────────────────────────────────
  if (totalMovimentos === 0) {
    return {
      semDados: true,
      resumo:
        "Ainda não há movimentos registados, por isso não há nada para analisar. Assim que registar algumas receitas e despesas, esta página começa a dizer-lhe coisas sobre o seu dinheiro que os gráficos sozinhos não dizem.",
      insights: [
        {
          id: "comecar",
          tom: "neutro",
          titulo: "Comece pelo mais simples",
          observacao: "Zero movimentos registados até agora.",
          porque:
            "Uma app de finanças não adivinha nada: só sabe o que lhe contarem. Bastam duas semanas de registos para começar a ver padrões.",
          acao: { texto: "Registar o primeiro movimento", href: "/movimentos/novo" },
        },
      ],
    };
  }

  const { incomeCents, expenseCents, netCents } = resumoPeriodo;

  // ── 1. Taxa de poupança ──────────────────────────────────────────────────
  if (incomeCents > 0) {
    const taxa = percentagem(netCents, incomeCents);
    const tom: Tom = taxa >= 20 ? "bom" : taxa >= 5 ? "neutro" : taxa >= 0 ? "atencao" : "mau";
    insights.push({
      id: "taxa-poupanca",
      tom,
      titulo: "Quanto sobra do que recebe",
      observacao:
        netCents >= 0
          ? `De cada 100 € que entraram, sobraram ${taxa} €. Em números: entraram ${formatCents(incomeCents)}, saíram ${formatCents(expenseCents)}, sobraram ${formatCents(netCents)}.`
          : `Gastou mais do que recebeu: ${formatCents(-netCents)} a mais. Entraram ${formatCents(incomeCents)} e saíram ${formatCents(expenseCents)}.`,
      porque:
        netCents >= 0
          ? "Esta é a percentagem que interessa mais do que o salário. Quem recebe muito e gasta tudo não constrói nada; quem recebe pouco e guarda 10% constrói. É o único número que mede o que consegue controlar."
          : "Um mês negativo não é uma catástrofe — pode ter sido uma despesa grande e pontual. Dois ou três seguidos já é um padrão, e aí o dinheiro vem de algum lado: poupanças ou dívida.",
      acao:
        netCents < 0
          ? { texto: "Ver para onde foi o dinheiro", href: "/despesas" }
          : undefined,
    });
  }

  // ── 2. A categoria que mais subiu ────────────────────────────────────────
  const anteriorPorId = new Map(
    despesasAnterior.map((c) => [c.categoryId, c.cents]),
  );
  let maiorSubida: { nome: string; agora: number; antes: number; pct: number } | null =
    null;

  for (const cat of despesasPorCategoria) {
    const antes = anteriorPorId.get(cat.categoryId) ?? 0;
    const pct = variacao(cat.cents, antes);
    // Só vale a pena falar de subidas com alguma expressão: mais de 25% e
    // mais de 20 € de diferença. Senão enche a página de ruído.
    if (pct === null || pct < 25) continue;
    if (cat.cents - antes < 2_000) continue;
    if (!maiorSubida || pct > maiorSubida.pct) {
      maiorSubida = { nome: cat.name, agora: cat.cents, antes, pct };
    }
  }

  if (maiorSubida) {
    insights.push({
      id: "maior-subida",
      tom: "atencao",
      titulo: `${maiorSubida.nome} subiu`,
      observacao: `Gastou ${formatCents(maiorSubida.agora)} em ${maiorSubida.nome.toLowerCase()}, mais ${maiorSubida.pct}% do que no período anterior (${formatCents(maiorSubida.antes)}).`,
      porque:
        "Subidas assim costumam passar despercebidas porque acontecem aos poucos, em compras pequenas. Ver o total lado a lado com o mês anterior é a forma mais rápida de dar por elas.",
      acao: { texto: "Ver os movimentos", href: "/despesas" },
    });
  }

  // ── 3. Projeção até ao fim do mês ────────────────────────────────────────
  // Só faz sentido se o período em causa incluir hoje e já tiver decorrido
  // alguma coisa. Uma projeção com dois dias de dados não vale nada.
  const dentroDoPeriodo = hoje >= period.from && hoje <= period.to;
  const diasDecorridos = dentroDoPeriodo ? diffDays(period.from, hoje) + 1 : 0;
  const diasTotais = diffDays(period.from, period.to) + 1;

  if (dentroDoPeriodo && diasDecorridos >= 5 && diasDecorridos < diasTotais) {
    const ritmoDiario = Math.round(expenseCents / diasDecorridos);
    const projecao = ritmoDiario * diasTotais;
    const diasQueFaltam = diasTotais - diasDecorridos;
    insights.push({
      id: "projecao",
      tom: incomeCents > 0 && projecao > incomeCents ? "mau" : "neutro",
      titulo: "Se continuar a este ritmo",
      observacao: `Levou ${diasDecorridos} dias a gastar ${formatCents(expenseCents)}, o que dá ${formatCents(ritmoDiario)} por dia. Faltam ${diasQueFaltam} dias, por isso o período deve fechar perto de ${formatCents(projecao)}.`,
      porque:
        "É uma estimativa simples: o que já gastou a dividir pelos dias que passaram, multiplicado pelos dias todos. Não sabe das despesas grandes que ainda faltam nem das que já não se repetem — serve para dar o alerta cedo, não para ser exato.",
      acao:
        incomeCents > 0 && projecao > incomeCents
          ? { texto: "Rever o orçamento", href: "/orcamento" }
          : undefined,
    });
  }

  // ── 4. O peso das contas fixas ───────────────────────────────────────────
  if (orcamento.plannedTotal > 0 && incomeCents > 0) {
    const peso = percentagem(orcamento.plannedTotal, incomeCents);
    const tom: Tom = peso > 80 ? "mau" : peso > 60 ? "atencao" : "neutro";
    insights.push({
      id: "peso-fixas",
      tom,
      titulo: "O que já está comprometido",
      observacao: `O orçamento deste mês soma ${formatCents(orcamento.plannedTotal)}, o que são ${peso}% do que recebe.`,
      porque:
        peso > 60
          ? "Quando as contas fixas passam de metade do rendimento, sobra pouca margem para o imprevisto — e é o imprevisto que costuma obrigar a pedir emprestado. Não é uma regra rígida, mas é um sinal a que vale a pena estar atento."
          : "Saber quanto do seu dinheiro já tem dono antes do mês começar é o que lhe diz quanto pode mesmo gastar no resto sem se enganar.",
      acao: { texto: "Ver o orçamento", href: "/orcamento" },
    });
  }

  // ── 5. Categorias acima do orçamento ─────────────────────────────────────
  const estouradas = orcamento.rows.filter((r) => r.over);
  if (estouradas.length > 0) {
    const pior = estouradas[0];
    insights.push({
      id: "orcamento-estourado",
      tom: "atencao",
      titulo:
        estouradas.length === 1
          ? "Uma categoria passou do previsto"
          : `${estouradas.length} categorias passaram do previsto`,
      observacao: `Em ${pior.name.toLowerCase()} planeou ${formatCents(pior.plannedCents)} e já vai em ${formatCents(pior.spentCents)}.`,
      porque:
        "Passar do orçamento não é falhar — muitas vezes é o orçamento que estava mal medido. Se acontecer três meses seguidos na mesma categoria, o número a corrigir é o do plano, não o do gasto.",
      acao: { texto: "Ajustar o orçamento", href: "/orcamento" },
    });
  }

  // ── 6. O veículo: de cada euro recebido, quanto fica ─────────────────────
  for (const veiculo of veiculos.slice(0, 2)) {
    const stats = await getVehicleStats(workspaceId, veiculo.id, range);
    if (!stats) continue;

    if (stats.revenueCents > 0) {
      const margem = percentagem(stats.profitCents, stats.revenueCents);
      insights.push({
        id: `veiculo-${veiculo.id}`,
        tom: margem >= 60 ? "bom" : margem >= 35 ? "neutro" : "atencao",
        titulo: `${stats.name}: o que fica para si`,
        observacao: `Recebeu ${formatCents(stats.revenueCents)} e gastou ${formatCents(stats.costCents)} com o veículo. Sobraram ${formatCents(stats.profitCents)} — de cada 100 € recebidos, ficam ${margem} €.`,
        porque:
          "É esta a diferença entre receita e lucro. Quem só olha para o que recebe acha que ganhou mais do que ganhou; o combustível e a manutenção saem do mesmo dinheiro. Este número é o que deve usar para decidir se vale a pena aceitar um trabalho.",
        acao: { texto: "Detalhe do veículo", href: `/veiculos/${veiculo.id}` },
      });
    }

    if (stats.costPerKmCents !== null && stats.metres > 0) {
      insights.push({
        id: `custo-km-${veiculo.id}`,
        tom: "neutro",
        titulo: "Quanto custa cada quilómetro",
        observacao: `Percorreu ${metresToKmString(stats.metres)} km e gastou ${formatCents(stats.costCents)}, o que dá ${formatCostPerKm(stats.costPerKmCents)}.`,
        porque:
          "Serve para saber se um trabalho compensa antes de o aceitar: se lhe pagam ao quilómetro, tudo o que estiver abaixo deste valor dá prejuízo. É uma estimativa a partir dos custos que registou neste período — quantos mais abastecimentos registar, mais fiável fica.",
      });
    } else if (veiculo.active) {
      insights.push({
        id: `sem-custo-km-${veiculo.id}`,
        tom: "neutro",
        titulo: "Ainda não sei o custo por quilómetro",
        observacao: `Não há quilómetros registados para ${veiculo.name} neste período.`,
        porque:
          "Sem quilómetros não há como calcular. E prefiro dizer-lhe isto do que inventar um valor de tabela: os consumos reais variam muito com o trânsito, a carga e a forma de conduzir.",
        acao: { texto: "Registar um trabalho", href: "/trabalhos" },
      });
    }
  }

  // ── 7. A maior despesa do período ────────────────────────────────────────
  if (despesasPorCategoria.length > 0 && expenseCents > 0) {
    const maior = despesasPorCategoria[0];
    const peso = percentagem(maior.cents, expenseCents);
    if (peso >= 25) {
      insights.push({
        id: "categoria-dominante",
        tom: "neutro",
        titulo: `${maior.name} leva a maior fatia`,
        observacao: `${formatCents(maior.cents)} em ${maior.name.toLowerCase()}, que são ${peso}% de tudo o que gastou.`,
        porque:
          "Quando uma categoria pesa mais de um quarto do total, é aí que uma poupança pequena em percentagem dá mais dinheiro ao fim do mês do que cortar em cinco categorias pequenas.",
      });
    }
  }

  // ── 8. Hábito de registo ─────────────────────────────────────────────────
  if (ultimoMovimento) {
    const diasSemRegistar = diffDays(
      ultimoMovimento.date.toISOString().slice(0, 10) as IsoDate,
      hoje,
    );
    if (diasSemRegistar >= 7) {
      insights.push({
        id: "sem-registos",
        tom: "atencao",
        titulo: "Há uns dias sem registos",
        observacao: `O último movimento registado foi há ${diasSemRegistar} dias.`,
        porque:
          "Nada aqui está errado — mas os números só valem o que valem os registos. Uma app de finanças com metade das despesas de fora dá uma falsa sensação de folga.",
        acao: { texto: "Pôr em dia", href: "/movimentos/novo" },
      });
    }
  }

  // ── 9. Nota didática sobre transferências ────────────────────────────────
  if (transferencias > 0) {
    insights.push({
      id: "transferencias",
      tom: "bom",
      titulo: "As transferências não contam como despesa",
      observacao: `Tem ${transferencias} transferência${transferencias === 1 ? "" : "s"} registada${transferencias === 1 ? "" : "s"} entre as suas contas.`,
      porque:
        "Passar dinheiro da conta à ordem para a poupança não é gastar — é mudar de bolso. Muita gente conta isso como despesa e fica com a ideia de que gasta mais do que gasta. Aqui essas transferências não entram nas despesas nem no lucro, de propósito.",
    });
  }

  // ── Resumo em palavras ───────────────────────────────────────────────────
  const partes: string[] = [];
  partes.push(
    `Em ${period.label.toLowerCase()}, entraram ${formatCents(incomeCents)} e saíram ${formatCents(expenseCents)}.`,
  );
  if (incomeCents > 0) {
    partes.push(
      netCents >= 0
        ? `Sobraram ${formatCents(netCents)}, ou seja ${percentagem(netCents, incomeCents)}% do que recebeu.`
        : `Faltaram ${formatCents(-netCents)} para as contas fecharem.`,
    );
  }
  const varDespesa = variacao(expenseCents, resumoAnterior.expenseCents);
  if (varDespesa !== null && Math.abs(varDespesa) >= 10) {
    partes.push(
      varDespesa > 0
        ? `Gastou mais ${varDespesa}% do que no período anterior.`
        : `Gastou menos ${Math.abs(varDespesa)}% do que no período anterior.`,
    );
  }
  partes.push(`Neste momento tem ${formatCents(saldo)} somando todas as contas.`);

  return { semDados: false, resumo: partes.join(" "), insights };
}

/**
 * Explicações curtas dos termos que a app usa de forma própria.
 *
 * Está aqui e não numa página de ajuda escondida porque ninguém procura
 * ajuda — lê-se se estiver no caminho.
 */
export const GLOSSARIO: { termo: string; explicacao: string }[] = [
  {
    termo: "Receita não é lucro",
    explicacao:
      "Receita é o que entra. Lucro é o que fica depois de pagar o que foi preciso para o ganhar. Num trabalho de entregas, os 60 € que recebeu não são 60 € seus: o combustível saiu do mesmo bolso.",
  },
  {
    termo: "Custo por quilómetro",
    explicacao:
      "Tudo o que gastou com o veículo a dividir pelos quilómetros que fez. Diz-lhe o mínimo que lhe têm de pagar ao km para não estar a trabalhar de graça.",
  },
  {
    termo: "Transferência",
    explicacao:
      "Dinheiro que muda de conta sem sair do seu bolso. Não é despesa nem receita, e por isso não mexe no lucro — só no saldo de cada conta.",
  },
  {
    termo: "Saldo e orçamento",
    explicacao:
      "O saldo é o que tem agora. O orçamento é o que planeou gastar. Ter saldo não quer dizer que possa gastar: parte dele já pode ter dono.",
  },
  {
    termo: "Pessoal e profissional",
    explicacao:
      "Cada movimento pode ser marcado como um ou outro. Serve para saber se o negócio dá lucro sozinho, sem o ordenado a disfarçar as contas.",
  },
];
