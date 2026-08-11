import type { Metadata } from "next";
import { Archive, ArchiveRestore } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { listCategories } from "@/server/categories";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CategoryForm } from "./category-form";
import { toggleArchiveCategoryAction } from "./actions";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  const session = await requireSession("/categorias");
  const all = await listCategories(session.workspaceId, undefined, true);

  const groups = [
    { type: "EXPENSE" as const, title: "Despesas" },
    { type: "INCOME" as const, title: "Receitas" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias"
        description="Para onde vai — e de onde vem — o seu dinheiro."
      />

      <CategoryForm />

      {groups.map(({ type, title }) => {
        const items = all.filter((c) => c.type === type);
        return (
          <section key={type}>
            <h2 className="mt-4 mb-2 text-xs font-semibold text-muted">
              {title} ({items.filter((c) => !c.archived).length})
            </h2>
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {items.map((category) => (
                  <li
                    key={category.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 ${
                      category.archived ? "opacity-60" : ""
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: category.color ?? "var(--muted)" }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {category.name}
                    </span>
                    {category.scope === "BUSINESS" ? (
                      <Badge tone="primary">Profissional</Badge>
                    ) : null}
                    {category.archived ? <Badge>Arquivada</Badge> : null}
                    <form
                      action={toggleArchiveCategoryAction}
                      className="shrink-0"
                    >
                      <input type="hidden" name="id" value={category.id} />
                      <button
                        type="submit"
                        title={
                          category.archived
                            ? "Reativar categoria"
                            : "Arquivar categoria"
                        }
                        aria-label={`${category.archived ? "Reativar" : "Arquivar"} ${category.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-ink"
                      >
                        {category.archived ? (
                          <ArchiveRestore size={15} aria-hidden />
                        ) : (
                          <Archive size={15} aria-hidden />
                        )}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}

      <p className="pt-2 text-[11px] leading-relaxed text-faint">
        As categorias não se apagam — arquivam-se. Assim os movimentos antigos
        continuam a fazer sentido e os totais do passado não mudam.
      </p>
    </div>
  );
}
