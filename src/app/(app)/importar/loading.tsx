import { Skeleton } from "@/components/ui";
import { EsqueletoLista } from "@/components/visual";

/**
 * Esqueleto com a forma desta pagina, para nada saltar quando os dados
 * chegam. Ver o comentario em `src/app/(app)/loading.tsx`.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="A carregar">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-56" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
      <EsqueletoLista linhas={6} />
    </div>
  );
}
