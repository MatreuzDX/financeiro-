import { Skeleton } from "@/components/ui";
import {
  EsqueletoGrafico,
  EsqueletoIndicador,
  EsqueletoLista,
} from "@/components/visual";

/**
 * Esqueleto de carregamento.
 *
 * Tem a FORMA do que vem a seguir — o cartão do saldo, os três indicadores,
 * um gráfico, a lista. Quando o conteúdo real chega, nada muda de sítio, e é
 * essa ausência de salto que faz a app parecer instantânea mesmo quando o
 * servidor demorou o mesmo de sempre.
 *
 * Antes eram retângulos cinzentos genéricos: mantinham a página ocupada mas
 * não diziam o que vinha aí, e a chegada do conteúdo era um solavanco.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="A carregar">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-3.5 w-52" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* O cartão do saldo, com o sítio da minigráfica já reservado. */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-10 w-44" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <EsqueletoIndicador />
        <EsqueletoIndicador />
        <EsqueletoIndicador />
      </div>

      <EsqueletoGrafico />
      <EsqueletoLista linhas={4} />
    </div>
  );
}
