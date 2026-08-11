/**
 * Guarda estrutural contra uma classe inteira de bugs.
 *
 * Quando um Server Component importa um valor que NÃO é um componente de um
 * módulo `"use client"`, o Next substitui-o por uma referência de cliente que
 * lança ou é inútil. Não há erro de compilação, não há aviso do TypeScript:
 * só um erro em tempo de execução, às vezes silencioso.
 *
 * Aconteceu duas vezes neste projeto:
 *   • `THEME_COOKIE` → o nome do cookie passou a ser uma função, a Server
 *     Action respondia 500 e o tema nunca ficava guardado
 *   • `MAIN_NAV` → "MAIN_NAV.filter is not a function", a página /mais em erro
 *
 * Regra: de um módulo `"use client"` só se importam COMPONENTES (nome com
 * maiúscula) ou tipos. Constantes e funções partilhadas vivem em `src/lib`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function isClientModule(file: string): boolean {
  const head = readFileSync(file, "utf8").slice(0, 200);
  return /^\s*["']use client["']/m.test(head);
}

/** Extrai os nomes importados de cada `import … from "@/…"`. */
function namedImportsFrom(
  source: string,
): { specifier: string; names: string[]; typeOnly: boolean }[] {
  const out: { specifier: string; names: string[]; typeOnly: boolean }[] = [];
  const re = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const names = match[2]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    out.push({
      specifier: match[3],
      names,
      typeOnly: Boolean(match[1]),
    });
  }
  return out;
}

function resolveAlias(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;
  const base = path.join(SRC, specifier.slice(2));
  for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* segue para o próximo */
    }
  }
  return null;
}

describe("fronteira servidor / cliente", () => {
  it("nenhum módulo de servidor importa valores não-componentes de um módulo 'use client'", () => {
    const offences: string[] = [];

    for (const file of walk(SRC)) {
      if (isClientModule(file)) continue; // de cliente para cliente é válido

      const source = readFileSync(file, "utf8");
      for (const imp of namedImportsFrom(source)) {
        if (imp.typeOnly) continue;
        const target = resolveAlias(imp.specifier);
        if (!target || !isClientModule(target)) continue;

        for (const raw of imp.names) {
          const name = raw.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
          if (raw.trim().startsWith("type ")) continue; // `import { type X }`
          // Componentes começam por maiúscula; tudo o resto é um valor que
          // não sobrevive à travessia da fronteira.
          if (!/^[A-Z]/.test(name)) {
            offences.push(
              `${path.relative(SRC, file)} importa "${name}" de ${imp.specifier} ("use client")`,
            );
          }
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it("as constantes partilhadas estão mesmo em módulos neutros", () => {
    for (const file of ["lib/theme.ts", "lib/navigation.ts"]) {
      const full = path.join(SRC, file);
      const source = readFileSync(full, "utf8");
      expect(source).not.toMatch(/^\s*["']use client["']/m);
      expect(source).not.toMatch(/from ["']server-only["']/);
    }
  });
});
