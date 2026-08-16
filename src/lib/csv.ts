/**
 * Leitura de ficheiros de extrato bancário.
 *
 * Este módulo é puro: entra texto, sai estrutura. Não sabe o que é uma conta
 * nem uma categoria. Toda a lógica arriscada — adivinhar o separador, ler uma
 * data portuguesa, ler um valor com pontos e vírgulas — vive aqui, onde pode
 * ser testada sem base de dados.
 *
 * PORQUE É QUE ISTO NÃO É TRIVIAL: não existe "o formato CSV do banco". O
 * Millennium exporta com `;`, a Caixa com `;` e datas `DD-MM-YYYY`, o Revolut
 * com `,` e datas ISO, o Santander separa débitos e créditos em duas colunas.
 * Um analisador que só saiba ler um deles é um analisador que não serve.
 *
 * A regra que atravessa o ficheiro todo: **na dúvida, devolver `null` e deixar
 * a pessoa corrigir**. Numa app de dinheiro, adivinhar mal é pior do que não
 * adivinhar.
 */

import { isValidIsoDate, type IsoDate } from "@/lib/date";
import { parseAmountToCents, type Cents } from "@/lib/money";

// ─── Separador e grelha ────────────────────────────────────────────────────

const CANDIDATE_DELIMITERS = [";", ",", "\t", "|"] as const;
export type Delimiter = (typeof CANDIDATE_DELIMITERS)[number];

/**
 * Analisa uma linha delimitada respeitando aspas ao estilo RFC 4180:
 * `"Pagamento ""MB WAY"";obrigado"` é UM campo com aspas lá dentro.
 *
 * Escrito à mão em vez de usar `split(delim)` porque descrições bancárias
 * levam vírgulas e ponto e vírgula com frequência — "TRF P/ SILVA, MARIA".
 */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

/**
 * Parte o texto em linhas, mas sem cortar dentro de aspas — há bancos que
 * exportam descrições com quebras de linha lá dentro.
 */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      records.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current !== "") records.push(current);
  return records;
}

/**
 * Adivinha o separador pela CONSISTÊNCIA, não pela contagem.
 *
 * Contar ocorrências engana-se sempre que as descrições têm vírgulas: um
 * ficheiro com `;` e cinco vírgulas por descrição elege a vírgula. O sinal
 * fiável é outro — o separador verdadeiro produz o mesmo número de colunas em
 * todas as linhas. Entre dois igualmente consistentes, ganha o que dá mais
 * colunas (uma coluna só nunca é uma tabela).
 */
export function detectDelimiter(lines: string[]): Delimiter {
  const sample = lines.slice(0, 20);
  let best: Delimiter = ";";
  let bestScore = -1;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = sample.map((l) => splitLine(l, delimiter).length);
    const columns = counts[0] ?? 1;
    if (columns < 2) continue;
    const consistent = counts.filter((c) => c === columns).length;
    // Consistência primeiro, número de colunas como desempate.
    const score = consistent * 100 + columns;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

export type Grid = {
  delimiter: Delimiter;
  header: string[];
  rows: string[][];
};

/**
 * Texto → grelha com cabeçalho.
 *
 * Salta linhas de preâmbulo: os extratos do Millennium e da Caixa começam com
 * duas ou três linhas soltas ("Consulta de movimentos", o número da conta) antes
 * do cabeçalho verdadeiro. Procura-se a primeira linha com pelo menos duas
 * colunas preenchidas e que pareça um cabeçalho.
 */
export function parseGrid(text: string): Grid | null {
  // O BOM UTF-8 cola-se à primeira célula e estraga a deteção do cabeçalho.
  const clean = text.replace(/^﻿/, "");
  const lines = splitRecords(clean).filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;

  const delimiter = detectDelimiter(lines);

  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitLine(lines[i], delimiter);
    const filled = cells.filter((c) => c !== "").length;
    if (filled >= 2 && looksLikeHeader(cells)) {
      headerIndex = i;
      break;
    }
  }

  const header = splitLine(lines[headerIndex], delimiter);
  const rows = lines
    .slice(headerIndex + 1)
    .map((l) => splitLine(l, delimiter))
    // Uma linha sem nenhuma célula preenchida é lixo do fim do ficheiro.
    .filter((cells) => cells.some((c) => c !== ""));

  return { delimiter, header, rows };
}

/**
 * Um cabeçalho tem palavras, não números. Se a linha toda for datas e valores,
 * é já um movimento — o ficheiro veio sem cabeçalho.
 */
function looksLikeHeader(cells: string[]): boolean {
  const meaningful = cells.filter((c) => c !== "");
  if (meaningful.length < 2) return false;
  const numericish = meaningful.filter(
    (c) => parseBankDate(c) !== null || parseAmountToCents(c) !== null,
  ).length;
  return numericish < meaningful.length / 2;
}

// ─── Datas ─────────────────────────────────────────────────────────────────

/**
 * Lê a data de um extrato. Aceita, por esta ordem de tentativa:
 *   2026-08-15  (ISO, Revolut, N26)
 *   15-08-2026  15/08/2026  15.08.2026  (bancos portugueses)
 *   2026/08/15
 *
 * NÃO aceita o formato americano MM/DD/YYYY, e é de propósito: "05/03/2026" é
 * 5 de março em Portugal e 3 de maio nos Estados Unidos, e nada no ficheiro
 * diz qual é. Como esta app é só para Portugal, assume-se dia primeiro — a
 * leitura correta aqui — em vez de adivinhar.
 */
export function parseBankDate(raw: string): IsoDate | null {
  if (typeof raw !== "string") return null;
  // Alguns extratos trazem a hora colada: "15-08-2026 13:42".
  const s = raw.trim().split(/[ T]/)[0];
  if (s === "") return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (iso) return build(iso[1], iso[2], iso[3]);

  const pt = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (pt) {
    let year = pt[3];
    // "26" → 2026. Um extrato bancário nunca é do século passado.
    if (year.length === 2) year = `20${year}`;
    return build(year, pt[2], pt[1]);
  }

  return null;

  function build(y: string, m: string, d: string): IsoDate | null {
    const value = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isValidIsoDate(value) ? value : null;
  }
}

// ─── Valores ───────────────────────────────────────────────────────────────

/**
 * Lê o valor de uma célula de extrato.
 *
 * Além do que o `parseAmountToCents` já sabe, trata duas convenções que só
 * aparecem em extratos: parênteses para negativo — `(45,10)` — e o sinal
 * depois do número — `45,10-`, que o software de contabilidade antigo produz.
 */
export function parseBankAmount(raw: string): Cents | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (s === "") return null;

  let negative = false;

  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1).trim();
  }
  if (s.endsWith("+")) {
    s = s.slice(0, -1).trim();
  }

  const cents = parseAmountToCents(s);
  if (cents === null) return null;
  return negative ? -Math.abs(cents) : cents;
}

// ─── Reconhecer as colunas ─────────────────────────────────────────────────

export type ColumnRole = "data" | "descricao" | "valor" | "debito" | "credito";

/**
 * Nomes de coluna vistos em extratos portugueses. Compara-se sem acentos e
 * sem maiúsculas, e por *começo* do nome — "Data valor" e "Data movimento"
 * são ambos a data, e mais vale acertar nos dois do que listar vinte
 * variantes.
 */
const COLUMN_HINTS: Record<ColumnRole, string[]> = {
  data: ["data", "date", "dt "],
  descricao: [
    "descricao",
    "descritivo",
    "movimento",
    "description",
    "designacao",
    "historico",
    "detalhe",
    "referencia",
  ],
  valor: ["valor", "montante", "importancia", "amount", "quantia"],
  debito: ["debito", "debit", "saida", "levantamento"],
  credito: ["credito", "credit", "entrada", "deposito"],
};

/** "Descrição" → "descricao". Sem isto, nenhum cabeçalho português coincide. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type ColumnMap = {
  data: number | null;
  descricao: number | null;
  valor: number | null;
  debito: number | null;
  credito: number | null;
};

/**
 * Adivinha que coluna é o quê — primeiro pelo nome no cabeçalho, e onde o
 * nome não chegar, pelo CONTEÚDO das primeiras linhas. Um ficheiro sem
 * cabeçalho reconhecível ainda assim se importa, porque uma coluna toda de
 * datas só pode ser a data.
 *
 * "Saldo" é o caso que obriga a ter cuidado: parece um valor, é um valor, e
 * importá-lo em vez do montante estraga o extrato todo. Por isso é excluído
 * pelo nome antes de qualquer análise de conteúdo.
 */
export function detectColumns(header: string[], rows: string[][]): ColumnMap {
  const map: ColumnMap = {
    data: null,
    descricao: null,
    valor: null,
    debito: null,
    credito: null,
  };
  const taken = new Set<number>();
  const names = header.map(normalize);

  const isBalance = (name: string) =>
    name.startsWith("saldo") || name.startsWith("balance");

  // 1ª passagem: pelo nome. Débito e crédito antes de "valor", senão uma
  // coluna "Valor débito" era apanhada como o montante único.
  const order: ColumnRole[] = ["data", "debito", "credito", "valor", "descricao"];
  for (const role of order) {
    for (let i = 0; i < names.length; i++) {
      if (taken.has(i) || isBalance(names[i])) continue;
      if (COLUMN_HINTS[role].some((hint) => names[i].startsWith(hint))) {
        map[role] = i;
        taken.add(i);
        break;
      }
    }
  }

  // 2ª passagem: pelo conteúdo, só para o que ficou por preencher.
  const sample = rows.slice(0, 12);
  const columnCount = Math.max(header.length, ...sample.map((r) => r.length), 0);

  const share = (index: number, test: (cell: string) => boolean) => {
    const cells = sample.map((r) => r[index] ?? "").filter((c) => c !== "");
    if (cells.length === 0) return 0;
    return cells.filter(test).length / cells.length;
  };

  if (map.data === null) {
    for (let i = 0; i < columnCount; i++) {
      if (taken.has(i) || isBalance(names[i] ?? "")) continue;
      if (share(i, (c) => parseBankDate(c) !== null) >= 0.8) {
        map.data = i;
        taken.add(i);
        break;
      }
    }
  }

  if (map.valor === null && map.debito === null && map.credito === null) {
    // Entre várias colunas numéricas, a do montante é a que MUDA de sinal.
    // O saldo de uma conta com dinheiro é sempre positivo; os movimentos não.
    let fallback: number | null = null;
    for (let i = 0; i < columnCount; i++) {
      if (taken.has(i) || isBalance(names[i] ?? "")) continue;
      if (share(i, (c) => parseBankAmount(c) !== null) < 0.8) continue;
      const values = sample
        .map((r) => parseBankAmount(r[i] ?? ""))
        .filter((v): v is number => v !== null);
      if (values.some((v) => v < 0)) {
        map.valor = i;
        taken.add(i);
        break;
      }
      if (fallback === null) fallback = i;
    }
    if (map.valor === null && fallback !== null) {
      map.valor = fallback;
      taken.add(fallback);
    }
  }

  if (map.descricao === null) {
    // O que sobra: a coluna com mais texto que não é data nem número.
    let best: number | null = null;
    let bestLength = 0;
    for (let i = 0; i < columnCount; i++) {
      if (taken.has(i)) continue;
      const cells = sample.map((r) => r[i] ?? "").filter((c) => c !== "");
      if (cells.length === 0) continue;
      const textual = cells.filter(
        (c) => parseBankDate(c) === null && parseBankAmount(c) === null,
      );
      if (textual.length < cells.length * 0.8) continue;
      const avg = textual.reduce((s, c) => s + c.length, 0) / textual.length;
      if (avg > bestLength) {
        bestLength = avg;
        best = i;
      }
    }
    map.descricao = best;
  }

  return map;
}

// ─── Linhas prontas a importar ─────────────────────────────────────────────

export type ParsedRow = {
  /** Número da linha no ficheiro, a contar do cabeçalho. Para dizer onde falhou. */
  lineNumber: number;
  date: IsoDate | null;
  description: string;
  /** Negativo = saiu dinheiro, positivo = entrou. */
  amountCents: Cents | null;
  /** Porque é que esta linha não serve. `null` quando está boa. */
  problem: string | null;
};

/**
 * Aplica o mapa de colunas a todas as linhas.
 *
 * Linhas más NÃO são deitadas fora em silêncio: voltam com `problem` escrito,
 * para a pré-visualização as mostrar. Um extrato onde 4 de 200 linhas falham
 * deve importar 196 e dizer quais são as 4 — não recusar o ficheiro inteiro
 * nem, pior, importar 196 sem avisar.
 */
export function extractRows(grid: Grid, map: ColumnMap): ParsedRow[] {
  return grid.rows.map((cells, index) => {
    const lineNumber = index + 2; // +1 pelo cabeçalho, +1 porque se conta de 1
    const rawDate = map.data === null ? "" : (cells[map.data] ?? "");
    const date = parseBankDate(rawDate);

    const description =
      map.descricao === null ? "" : (cells[map.descricao] ?? "").trim();

    let amountCents: Cents | null = null;
    if (map.valor !== null) {
      amountCents = parseBankAmount(cells[map.valor] ?? "");
    } else {
      // Colunas separadas: o débito é sempre uma saída, mesmo quando o banco
      // o escreve sem sinal. É este `-Math.abs` que evita importar despesas
      // como receitas — o erro mais caro que esta funcionalidade podia ter.
      const debit = map.debito === null ? null : parseBankAmount(cells[map.debito] ?? "");
      const credit =
        map.credito === null ? null : parseBankAmount(cells[map.credito] ?? "");
      if (debit !== null && debit !== 0) amountCents = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amountCents = Math.abs(credit);
    }

    let problem: string | null = null;
    if (date === null) {
      problem = rawDate.trim() === "" ? "Sem data" : `Data ilegível: "${rawDate}"`;
    } else if (amountCents === null || amountCents === 0) {
      problem = "Sem valor";
    } else if (description === "") {
      problem = "Sem descrição";
    }

    return { lineNumber, date, description, amountCents, problem };
  });
}
