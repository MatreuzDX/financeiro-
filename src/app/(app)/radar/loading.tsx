import { Skeleton } from "@/components/ui";
import { EsqueletoGrafico, EsqueletoIndicador } from "@/components/visual";

/**
 * Esqueleto com a forma desta pagina, para nada saltar quando os dados
 * chegam. Ver o comentario em `src/app/(app)/loading.tsx`.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="A carregar">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-64" />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <Skeleton className="mx-auto h-3 w-32" />
        <Skeleton className="mx-auto mt-2 h-9 w-40" />
        <Skeleton className="mx-auto mt-2 h-3 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <EsqueletoIndicador />
        <EsqueletoIndicador />
      </div>
      <EsqueletoGrafico altura={160} />
    </div>
  );
}
