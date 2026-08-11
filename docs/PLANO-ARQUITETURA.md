# Plano de Arquitetura — SaaS de Gestão Financeira Pessoal e Profissional

**Data:** 2026-08-10 · **Estado:** plano para aprovação, nenhum código escrito ainda
**Nome de trabalho:** `finca` (a definir)

---

## 0. O que já verifiquei antes de escrever isto

Antes de propor seja o que for, olhei para o que já existe. Resumo honesto:

| O que verifiquei | O que encontrei |
|---|---|
| Pasta de trabalho `Desktop\chat` | **Vazia** — só tem `.claude\` (launch.json e permissões). Não há repositório, nem código, nem histórico. Projeto novo de raiz. |
| Vercel (conta `mateusdadiva16-5627s-projects`) | 2 projetos: `ayaha-crm` e `ayaha-maison`. **Nenhum relacionado com finanças.** Não vou tocar em nenhum. |
| Supabase (org `MatreuzDX's Org`) | 1 projeto, `eu-west-1`, Postgres 17 — **estado `INACTIVE` (pausado)**. Ver aviso na secção 12. |
| Ambiente local | Node 22.18, npm 10.9, Git 2.55. **`gh`, `vercel` e `supabase` CLI não estão instalados.** Docker não arranca sem admin (documentado no AYAHA). |
| Projeto de referência `ayaha-crm` | Next.js 16.2 + React 19 + Prisma 7 + Postgres + Tailwind 4 + Zod 4 + Recharts + argon2 + Vitest. Stack moderna e já dominada. |
| `Desktop\AYAHA-SKILLS\` | 5 lições pagas com horas de trabalho. Estão incorporadas neste plano — ver secção 17. |

**Decisão que daí resulta:** não há nada a preservar, nada a migrar, nada a partir. Podemos desenhar isto direito desde o primeiro commit. É raro e vale a pena aproveitar.

---

## 1. Resumo do projeto

Uma aplicação web (instalável como app no telemóvel) onde uma pessoa controla **todo** o dinheiro que entra e sai — o do dia-a-dia e o do trabalho — e consegue responder à única pergunta que interessa:

> **Quanto é que eu ganhei mesmo?**

Não "quanto recebi". **Quanto sobrou.**

O caso que guia todo o desenho: alguém com €920/mês de ordenado que também faz entregas com uma Honda PCX 2016. A pizzaria paga €0,40/km e ele fez 150 km → recebe €60. Um sistema mal feito diz "ganhaste €60". Um sistema bem feito diz:

```
Receita da sessão                              60,00 €
Custo do veículo (150 km × 0,082 €/km)        −12,30 €
─────────────────────────────────────────────────────
Lucro da atividade                             47,70 €
```

E sabe explicar de onde vem aquele `0,082 €/km`.

Tudo o resto — dashboard, orçamento, metas, IA, relatórios — existe ao serviço disto.

---

## 2. Stack tecnológica recomendada

| Camada | Escolha | Porquê |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19** | Server Components tornam a app rápida no telemóvel (menos JS enviado). É o que já usas no `ayaha-crm` — o conhecimento transfere-se todo, incluindo as armadilhas. |
| Linguagem | **TypeScript strict** | Numa app financeira, um `undefined` onde devia estar um número é dinheiro errado no ecrã. |
| Estilos | **Tailwind CSS v4** + componentes locais (padrão shadcn/ui: CVA + clsx + tailwind-merge + lucide-react) | Componentes copiados para dentro do projeto, não uma dependência. Controlo total sobre o visual, que é meio ponto do pedido. |
| Base de dados | **PostgreSQL** | Transações ACID, constraints a sério, tipos numéricos exatos. Não é negociável para dinheiro. |
| ORM | **Prisma 7** (`@prisma/adapter-pg`) | Migrações versionadas, tipos gerados, e já sabes onde ele morde. |
| Alojamento da BD | **Neon** (recomendado) | Ver secção 12 — a razão principal é o Supabase gratuito pausar projetos ao fim de 7 dias. |
| Autenticação | **Better Auth** | Ver secção 6 — decisão fundamentada, não é o que fizeste no AYAHA. |
| Validação | **Zod 4** | Um schema por operação, partilhado entre formulário e servidor. |
| Formulários | **react-hook-form** + `@hookform/resolvers` | Já usado; não perde valores no erro (armadilha do AYAHA). |
| Gráficos | **Recharts 3** | Já dominado, responsivo, suficiente. Não vale a pena D3 nesta fase. |
| Datas | **date-fns 4** + **date-fns-tz** | Fuso `Europe/Lisbon` fixado explicitamente. Semana começa à segunda. |
| Testes | **Vitest** (unitário + integração) + **Playwright** (E2E) | Integração contra Postgres real, nunca mocks — lição `verificar-a-serio`. |
| Postgres local | **embedded-postgres** na porta **5433** | Docker não arranca nesta máquina sem admin. Já resolvido no AYAHA; copia-se o `scripts/dev-db.mjs`. |
| Deploy | **Vercel** + **GitHub** | Já ligados. Projeto novo, sem tocar nos existentes. |
| E-mail | **Resend** | Recuperação de palavra-passe e alertas. |
| IA | **Claude Opus 5** (`@anthropic-ai/sdk`) com *tool use* | Ver secção 11 — a IA nunca vê a base de dados. |
| Ficheiros (recibos) | **Vercel Blob** ou **Cloudflare R2** | Fase 5. R2 é mais barato à escala. |

### Bibliotecas adicionais previstas

`argon2` (via Better Auth), `nanoid` (IDs curtos legíveis), `papaparse` (importação CSV bancário), `@react-pdf/renderer` ou geração server-side de PDF (relatórios), `exceljs` ou CSV puro (exportação), `@tanstack/react-table` (tabelas de transações com ordenação/filtro), `rrule` ou lógica própria (recorrências — provavelmente própria, ver 5.6).

---

## 3. Arquitetura geral

Uma só aplicação Next.js. Sem microserviços, sem backend separado — seria complexidade sem retorno para este produto.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / PWA instalada no telemóvel                        │
│  Server Components (HTML) + ilhas de interatividade          │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Next.js 16 (Vercel)                                         │
│                                                              │
│  proxy.ts ─── 1.ª barreira: cookie existe? rota protegida?   │
│      │                                                       │
│  app/ ─────── páginas (Server Components)                    │
│      │        Server Actions (mutações)                      │
│      │        route handlers (webhooks, cron, export)        │
│      ▼                                                       │
│  src/server/ ── CAMADA DE DOMÍNIO (o coração)                │
│      ├── auth/        sessão, guardas, permissões            │
│      ├── money/       aritmética de dinheiro (única fonte)   │
│      ├── ledger/      lançamentos, saldos, invariantes       │
│      ├── budget/      orçamento vs real                      │
│      ├── vehicle/     km, combustível, custo/km              │
│      ├── work/        sessões de trabalho, lucro             │
│      ├── recurrence/  regras e materialização                │
│      ├── reports/     agregações                             │
│      └── ai/          ferramentas expostas ao modelo         │
│      ▼                                                       │
│  src/db/ ────── Prisma, sempre com escopo de workspace       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  PostgreSQL (Neon)    │
                │  constraints + triggers│
                │  auditoria imutável   │
                └───────────────────────┘
```

### Três regras de arquitetura que não se quebram

**1. Nenhuma página fala com o Prisma diretamente.** As páginas chamam funções de `src/server/*`. Isso mantém a lógica financeira num sítio testável, e impede que uma query esquecida contorne o escopo de workspace.

**2. O `workspaceId` vem *sempre* da sessão, nunca de um parâmetro.**

```ts
// SIM — não existe forma de pedir dados de outra pessoa
export async function criarTransacao(s: Sessao, input: {
  data: string; descricao: string; linhas: LinhaInput[];
  // repare-se: não existe workspaceId aqui
}) { … }
```

Isto é a lição `duas-zonas-de-confianca` aplicada. A garantia mais forte não é uma verificação — é a **ausência do parâmetro**.

**3. Toda a aritmética de dinheiro passa por `src/server/money`.** Não há um único `a + b` sobre valores monetários espalhado pelo código. Um módulo, testado com testes de propriedade.

---

## 4. Estrutura de pastas

```
financas/
├── .github/workflows/ci.yml        typecheck · lint · test · build
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                     categorias base pt-PT, nada de dados falsos
├── scripts/
│   ├── dev-db.mjs                  embedded-postgres :5433 (UTF8!)
│   ├── setup-admin.mjs             gera palavra-passe forte, mostra 1 vez
│   ├── backup.mjs                  pg_dump cifrado → object storage
│   └── check-invariants.mjs        soma de saldos = soma de lançamentos
├── docs/
│   ├── PLANO-ARQUITETURA.md        este ficheiro
│   ├── DECISOES.md                 registo de decisões (ADR leve)
│   └── PROXIMO-PASSO.md            fonte de verdade do que falta
├── public/
│   ├── manifest.webmanifest        PWA
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (marketing)/            landing pública (fase SaaS)
│   │   ├── (auth)/
│   │   │   ├── entrar/
│   │   │   ├── registar/
│   │   │   ├── recuperar/
│   │   │   └── redefinir/
│   │   ├── (app)/                  ← tudo aqui exige sessão
│   │   │   ├── layout.tsx          guarda + navegação (tabs no telemóvel)
│   │   │   ├── page.tsx            Dashboard
│   │   │   ├── movimentos/
│   │   │   ├── contas/
│   │   │   ├── categorias/
│   │   │   ├── orcamento/
│   │   │   ├── trabalho/           fontes de renda · sessões · clientes
│   │   │   ├── veiculos/
│   │   │   ├── metas/
│   │   │   ├── dividas/
│   │   │   ├── relatorios/
│   │   │   ├── assistente/         IA
│   │   │   └── definicoes/
│   │   └── api/
│   │       ├── auth/[...all]/      Better Auth
│   │       ├── cron/               recorrências · backup · lembretes
│   │       └── export/             CSV · PDF · exportação total
│   ├── components/
│   │   ├── ui/                     primitivos (Button, Sheet, Card…)
│   │   ├── charts/                 wrappers Recharts com tokens de cor
│   │   ├── money/                  <Money>, <Delta>, <Sparkline>
│   │   └── patterns/               EmptyState, Skeleton, ErrorState
│   ├── server/                     ← domínio (ver secção 3)
│   ├── db/
│   │   ├── client.ts
│   │   └── scope.ts                helper de workspace (cuidado com null!)
│   ├── lib/
│   │   ├── format.ts               formatEUR, formatKm, formatDate (pt-PT)
│   │   ├── period.ts               hoje/semana/mês/trimestre/ano/custom
│   │   └── env.ts                  validação de env com Zod ao arrancar
│   └── styles/
├── tests/
│   ├── unit/
│   ├── integration/                contra Postgres real
│   └── e2e/
├── .env.example                    todas as variáveis, zero segredos
├── AGENTS.md                       armadilhas do projeto, para futuros agentes
└── CLAUDE.md
```

---

## 5. Modelo da base de dados

### 5.1 A decisão central: partidas dobradas por baixo, linguagem humana por cima

Este é o ponto onde a maioria das apps financeiras se estraga. Vou ser explícito sobre a escolha.

**O problema:** se uma transação for só `{valor, categoria, conta}`, então:
- uma transferência entre contas aparece como despesa numa e receita noutra → o lucro fica inflacionado;
- pagar uma prestação de empréstimo (parte juros = despesa, parte capital = redução de dívida) não tem como ser representado corretamente;
- uma receita de €60 com €12 de custo associado não tem forma de se ligar;
- os saldos podem divergir dos movimentos sem que nada dê erro.

**A solução:** um **livro de lançamentos** onde cada transação tem 2 ou mais linhas que **somam sempre zero**. É o que o GnuCash, o Firefly III e o Actual Budget fazem, e é o que as referências de desenho de sistemas financeiros recomendam.

As categorias **são** contas (do tipo receita/despesa). Uma despesa de €50 no supermercado:

| Linha | Conta | Tipo | Valor |
|---|---|---|---|
| 1 | Cartão Multibanco | ASSET | −5000 |
| 2 | Alimentação/Supermercado | EXPENSE | +5000 |
| | | **soma** | **0** ✅ |

Uma transferência de €200 da conta à ordem para a poupança:

| Linha | Conta | Tipo | Valor |
|---|---|---|---|
| 1 | Conta à Ordem | ASSET | −20000 |
| 2 | Poupança | ASSET | +20000 |
| | | **soma** | **0** ✅ |

Nem receita nem despesa. O lucro não se mexe. Correto.

Uma prestação de €150 do empréstimo, dos quais €18 são juros:

| Linha | Conta | Tipo | Valor |
|---|---|---|---|
| 1 | Conta à Ordem | ASSET | −15000 |
| 2 | Empréstimo Moto | LIABILITY | +13200 |
| 3 | Juros | EXPENSE | +1800 |
| | | **soma** | **0** ✅ |

**O custo desta escolha:** é mais trabalho de implementar e o formulário tem de esconder isto por completo. O utilizador vê três botões — **Despesa**, **Receita**, **Transferência** — e nunca as palavras "débito" ou "crédito". A tradução entre o formulário simples e as linhas do livro vive num único módulo (`src/server/ledger/compose.ts`).

**O benefício:** os números batem certo por construção, e uma constraint na base de dados prova-o. Não é preciso confiar que o código não tem bugs.

### 5.2 Dinheiro: como se guarda

| Coisa | Tipo | Porquê |
|---|---|---|
| Valores monetários | `BigInt` — **cêntimos inteiros** | Nunca `Float`. `0.1 + 0.2 !== 0.3` em JavaScript, e isso em dinheiro é inaceitável. |
| Taxas unitárias (€/km, €/litro) | `Decimal(12, 4)` | €0,40/km precisa de mais casas do que cêntimos. Convertido para cêntimos **uma só vez**, no fim, com arredondamento explícito. |
| Quantidades (km, litros) | `Decimal(12, 3)` | |
| Percentagens (juros) | `Decimal(7, 4)` | |
| Moeda | `String(3)` ISO-4217, default `EUR` | Multi-moeda fica preparada, mas desligada na v1. |

**Regra de arredondamento:** *half-up* (0,5 arredonda para cima), aplicada uma única vez no fim de cada cálculo, documentada no `money.ts` e coberta por testes de propriedade. Nunca arredondar a meio de uma cadeia de cálculos.

### 5.3 Entidades — visão geral

```
Workspace ─┬─ Membership ── User ── Session
           │
           ├─ Account ────────── (ASSET | LIABILITY | INCOME | EXPENSE | EQUITY)
           │     └─ árvore de categorias (parentId)
           │
           ├─ Transaction ──┬── Entry (2..n, soma = 0)
           │                ├── Attachment (recibos)
           │                └── ↗ vehicleId? workSessionId? counterpartyId?
           │
           ├─ RecurringRule ──── gera ── ScheduledTransaction
           ├─ Budget ─────────── BudgetLine
           ├─ Goal ───────────── GoalContribution
           ├─ Debt ───────────── AmortizationRow
           ├─ IncomeSource ───── (Ordenado | Entregas | Freelance | Loja…)
           ├─ Counterparty ───── (Pizzaria X, senhorio, cliente…)
           │
           ├─ Vehicle ────────┬── OdometerReading
           │                  ├── FuelLog
           │                  └── VehicleCostSnapshot (custo/km calculado)
           │
           ├─ WorkSession ────── (turno de entregas → gera Transaction)
           ├─ Notification
           ├─ Settings
           └─ AuditLog (append-only, trigger impede UPDATE/DELETE)
```

### 5.4 Tabelas principais (esboço)

```prisma
model Workspace {
  id          String   @id @default(cuid())
  name        String
  currency    String   @default("EUR")
  timezone    String   @default("Europe/Lisbon")
  plan        Plan     @default(FREE)      // preparado para SaaS
  createdAt   DateTime @default(now())
  // …todas as relações
}

model Account {
  id            String       @id @default(cuid())
  workspaceId   String
  kind          AccountKind  // ASSET LIABILITY INCOME EXPENSE EQUITY
  subtype       AccountSubtype? // BANK CASH CARD SAVINGS INVESTMENT LOAN
  name          String
  parentId      String?      // árvore (categorias com subcategorias)
  scope         Scope        @default(PERSONAL) // PERSONAL | BUSINESS | BOTH
  icon          String?
  color         String?
  openingCents  BigInt       @default(0)
  isArchived    Boolean      @default(false)
  isSystem      Boolean      @default(false) // categorias base não apagáveis
  sortOrder     Int          @default(0)

  @@index([workspaceId, kind, isArchived])
  @@unique([workspaceId, parentId, name])
}

model Transaction {
  id             String     @id @default(cuid())
  workspaceId    String
  date           DateTime   @db.Date        // dia contabilístico
  description    String
  notes          String?
  status         TxStatus   @default(CLEARED) // SCHEDULED PENDING CLEARED VOID
  dueDate        DateTime?  @db.Date        // contas a pagar/receber
  scope          Scope      @default(PERSONAL)

  incomeSourceId String?
  counterpartyId String?
  vehicleId      String?
  workSessionId  String?
  recurringId    String?    // instância gerada por uma regra

  deletedAt      DateTime?  // soft delete — histórico nunca desaparece
  revision       Int        @default(1)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  entries        Entry[]

  @@index([workspaceId, date])
  @@index([workspaceId, status, dueDate])
  @@index([workspaceId, vehicleId, date])
  @@index([workspaceId, scope, date])
}

model Entry {
  id             String  @id @default(cuid())
  workspaceId    String
  transactionId  String
  accountId      String
  amountCents    BigInt  // com sinal; soma por transação = 0
  memo           String?

  @@index([workspaceId, accountId, id])
}
```

**Constraint que prova a correção** (migração SQL manual, `DEFERRABLE INITIALLY DEFERRED`):

```sql
CREATE CONSTRAINT TRIGGER entries_balance
  AFTER INSERT OR UPDATE OR DELETE ON "Entry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_transaction_balanced();
```

Se algum caminho de código tentar gravar uma transação desequilibrada, a base de dados recusa. Não é uma verificação que se pode esquecer de chamar.

**Auditoria imutável:**

```sql
CREATE TRIGGER audit_no_mutate
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION raise_immutable();
```

### 5.5 Veículo e trabalho — o módulo diferenciador

```prisma
model Vehicle {
  id              String   @id @default(cuid())
  workspaceId     String
  name            String              // "Honda PCX 2016"
  make            String?
  model           String?
  year            Int?
  plate           String?
  type            VehicleType         // MOTORCYCLE CAR SCOOTER BICYCLE VAN
  fuelType        FuelType?
  initialOdometer Decimal  @db.Decimal(12,1)
  usage           Scope    @default(BOTH)  // pessoal, profissional ou ambos
  businessShare   Decimal? @db.Decimal(5,4) // % de uso profissional
  isActive        Boolean  @default(true)
}

model FuelLog {
  id             String  @id @default(cuid())
  vehicleId      String
  date           DateTime @db.Date
  odometer       Decimal @db.Decimal(12,1)
  liters         Decimal @db.Decimal(8,3)
  pricePerLiter  Decimal @db.Decimal(8,4)
  totalCents     BigInt
  isFullTank     Boolean @default(true)   // necessário para calcular consumo
  transactionId  String?                  // liga-se ao movimento real
}

model WorkSession {
  id              String   @id @default(cuid())
  workspaceId     String
  incomeSourceId  String              // "Entregas"
  counterpartyId  String?             // "Pizzaria X"
  vehicleId       String?
  startedAt       DateTime
  endedAt         DateTime?
  odometerStart   Decimal? @db.Decimal(12,1)
  odometerEnd     Decimal? @db.Decimal(12,1)
  kmDriven        Decimal? @db.Decimal(10,2)
  deliveries      Int?
  payModel        PayModel            // PER_KM PER_DELIVERY HOURLY FIXED MIXED
  ratePerKm       Decimal? @db.Decimal(8,4)
  ratePerDelivery Decimal? @db.Decimal(8,4)
  ratePerHour     Decimal? @db.Decimal(8,4)
  fixedCents      BigInt?
  tipsCents       BigInt   @default(0)
  grossCents      BigInt              // calculado no servidor, nunca no cliente
  transactionId   String?             // a receita que esta sessão gerou
}
```

**Custo por quilómetro — como se calcula, e o que se mostra**

Duas métricas, ambas visíveis, ambas explicadas:

```
Custo variável/km = (combustível + manutenção + pneus) da janela ÷ km da janela
Custo total/km    = variável + (seguro + IUC + inspeção) ÷ km da janela
```

Janela por omissão: **últimos 90 dias**, configurável. Se não houver dados suficientes (< 200 km ou < 2 abastecimentos), o sistema **não inventa um número** — diz:

> Ainda não há dados suficientes para calcular o custo por quilómetro.
> Faltam pelo menos 2 abastecimentos registados.
> [Registar abastecimento]

Isto é a lição `honestidade-no-produto`. Um custo/km fabricado a partir de um abastecimento é pior do que nenhum, porque a pessoa toma decisões com ele.

**Depreciação fica DESLIGADA por omissão.** É um custo real, mas é uma estimativa com margem enorme e inflaciona o custo/km de forma que a pessoa não reconhece. Opção nas definições, com explicação, para quem quiser.

### 5.6 Recorrências

`RecurringRule` guarda a regra (frequência, intervalo, dia do mês, fim). Um cron diário **materializa** as próximas 60 dias em `Transaction` com `status = SCHEDULED`.

**Regra de ouro:** uma transação `SCHEDULED` **não conta** para saldos nem para lucro. Conta para:
- "contas próximas do vencimento" no dashboard
- previsão de fim de mês
- orçamento (coluna "já comprometido")

Quando a pessoa confirma (ou o dia chega e ela marca como paga), passa a `CLEARED` e só aí mexe nos saldos. Isto evita o erro clássico de mostrar dinheiro que ainda não saiu como se tivesse saído.

Alterar a regra **não reescreve o passado** — só afeta instâncias futuras ainda não confirmadas.

### 5.7 Edição, eliminação e histórico

| Ação | O que acontece |
|---|---|
| Editar transação | `revision++`, entrada em `AuditLog` com `before`/`after` em JSONB. Os saldos recalculam. |
| Apagar transação | **Soft delete** (`deletedAt`). Desaparece das listas e dos totais, permanece na base e na auditoria. |
| Apagar conta/categoria com movimentos | Bloqueado. Oferece-se **arquivar** (deixa de aparecer nos formulários, o histórico mantém-se) ou **fundir noutra**. |
| Apagar workspace | Exportação obrigatória primeiro, depois soft delete com 30 dias de retenção, depois purga. |

### 5.8 Índices e integridade

- Índice composto `(workspaceId, date)` em `Transaction` — serve 90% das consultas do dashboard.
- Índice `(workspaceId, accountId)` em `Entry` — cálculo de saldo.
- Chaves estrangeiras com `ON DELETE RESTRICT` em tudo o que é financeiro (não se apaga uma conta com movimentos por acidente).
- `@@unique([workspaceId, …])` em nomes de contas/categorias — evita duplicados por engano.
- Saldos **derivados** dos lançamentos, com uma tabela de cache `AccountBalance` atualizada na mesma transação SQL. Um script (`check-invariants.mjs`) compara cache vs soma real e corre no CI e semanalmente em produção.

---

## 6. Fluxo de autenticação

### Porquê Better Auth e não o que fizeste no AYAHA

No `ayaha-crm` escreveste a autenticação à mão (argon2 + cookie HMAC + OAuth Google manual). Funciona e é auditável. Mas para este produto recomendo **Better Auth**, por razões concretas e não por moda:

| Requisito teu | À mão | Better Auth |
|---|---|---|
| Login, logout, recuperação, alteração de palavra-passe | escrever tudo | incluído |
| Sessões na tua BD (não num terceiro) | sim | sim — os dados são teus |
| Revogar todas as sessões ao mudar palavra-passe | escrever | incluído |
| 2FA (TOTP) | escrever | plugin |
| Passkeys / WebAuthn | escrever (difícil de fazer bem) | plugin |
| Rate limiting no login | escrever | incluído |
| Organizações + membros + convites (fase SaaS) | escrever | plugin `organization` |
| Stripe / assinaturas (fase SaaS) | escrever | plugin |

O Auth.js v5 está em modo manutenção desde início de 2026 — só correções de segurança, sem funcionalidades novas. O Better Auth é o sucessor onde o desenvolvimento continua, é TypeScript-nativo e guarda tudo no teu Postgres.

**O que perco:** a auditabilidade de "são 200 linhas que eu li todas". Mitigo com: sessões e utilizadores em tabelas Prisma que eu controlo, e testes de integração que provam o isolamento entre workspaces independentemente da biblioteca.

**Se preferires manter o padrão do AYAHA, é uma escolha defensável** — diz e eu adapto o plano. Mas então o 2FA e as passkeys ficam para muito mais tarde.

### Fluxos

```
REGISTO
  email + palavra-passe (mín. 12 chars, verificada contra lista de comuns)
  → argon2id
  → cria User + Workspace pessoal + Membership(OWNER)
  → semeia categorias base pt-PT
  → email de verificação (Resend)

LOGIN
  rate limit por IP e por email (5 tentativas / 15 min)
  → verifica hash (tempo constante)
  → cria Session em BD
  → cookie httpOnly · Secure · SameSite=Lax · __Host- prefix
  → redireciona para /

RECUPERAÇÃO
  → token de uso único, 32 bytes, hash guardado (nunca o token em claro)
  → válido 30 min
  → resposta idêntica exista ou não a conta (não revela emails registados)
  → ao redefinir: APAGA TODAS AS SESSÕES  ← lição duas-zonas-de-confianca

ALTERAR PALAVRA-PASSE (autenticado)
  → pede a atual
  → apaga todas as outras sessões, mantém a atual
```

### Conta de administrador

O pedido: *"a senha inicial NÃO deve ser óbvia. Gerar uma senha inicial forte e aleatória e apresentar de forma segura."*

```bash
npm run setup:admin
```

```
✓ Conta de administrador criada

  Email:          mateusdadiva16@gmail.com
  Palavra-passe:  7Kq-vR2m$Ln8-Pw4Tz#Hd6

  ⚠  Esta palavra-passe é mostrada UMA única vez.
     Não fica guardada em lado nenhum em texto simples.
     Será obrigatório alterá-la no primeiro login.
```

- Gerada com `crypto.randomBytes` — 22 caracteres, ~128 bits de entropia.
- Guardada só como hash argon2id.
- `mustChangePassword = true`.
- Nunca em `.env`, nunca no código, nunca em git.
- Em produção o script recusa correr se já existir um administrador.

---

## 7. Sistema de permissões

Não repetimos as 38 permissões granulares do CRM — aqui o modelo é diferente (é a *tua* app, não uma equipa de salão).

```ts
type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "ACCOUNTANT";
```

| Papel | Pode |
|---|---|
| `OWNER` | tudo, incluindo faturação e apagar o workspace |
| `ADMIN` | tudo menos faturação e apagar workspace |
| `MEMBER` | criar/editar os seus próprios movimentos, ver o resto |
| `VIEWER` | só leitura (ex.: mostrar ao contabilista) |
| `ACCOUNTANT` | só leitura + exportação de relatórios |

Uma matriz num único ficheiro (`src/server/auth/permissions.ts`), com uma função `can(role, action, resource)`. Um ficheiro, um teste que percorre a matriz inteira.

**Três barreiras, não uma:**

1. `proxy.ts` — corre no edge, só vê se o cookie existe. Primeira barreira, **nunca a única** (não fala com a BD, não sabe se a sessão é válida).
2. `requireSession()` no início de cada página e Server Action — valida contra a BD.
3. Escopo de workspace na camada de dados — mesmo que 1 e 2 falhem, a query não devolve dados de outro workspace.

**Armadilha de prefixo de rota** (bug real do AYAHA):

```ts
// ERRADO: "/contas-poupanca" começa por "/conta"
if (pathname.startsWith("/conta")) …

// CERTO
function comecaPorSegmento(pathname: string, prefixo: string) {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}
```

---

## 8. Estrutura do dashboard

### Hierarquia — o que se vê primeiro no telemóvel

O ecrã de 375px é o desenho principal. O desktop é o mesmo, com mais colunas.

```
┌─────────────────────────────────┐
│  Agosto 2026        [◀ mês ▶]   │  ← seletor de período, sempre visível
├─────────────────────────────────┤
│                                 │
│   Disponível até fim do mês     │  ← O NÚMERO PRINCIPAL
│        368,40 €                 │     grande, sozinho, sem competição
│   ▁▂▄▅▇ 12 dias restantes       │
│                                 │
├─────────────────────────────────┤
│ Entrou      Saiu       Sobrou   │
│ 1.180 €    811 €      369 €     │  ← três números, uma linha
├─────────────────────────────────┤
│ ⚠ Renda vence em 3 dias  500 €  │  ← só aparece se houver algo
├─────────────────────────────────┤
│ ▸ Onde foi o dinheiro           │  gráfico de barras horizontais
│ ▸ Receita por fonte             │  ordenado · entregas · freelance
│ ▸ Evolução do saldo             │  linha, 6 meses
│ ▸ A moto este mês               │  card do veículo
│ ▸ Orçamento                     │  barras com limites
│ ▸ Metas                         │  anéis de progresso
└─────────────────────────────────┘
   [Início] [Movimentos] [+] [Orçamento] [Mais]   ← barra fixa
```

**O botão `+` é o mais importante da app.** Abre um *bottom sheet* com três separadores (Despesa · Receita · Transferência) e o mínimo de campos possível. Registar uma despesa tem de dar em 3 toques, ou a pessoa deixa de registar e a app morre.

### Cards do dashboard

| Card | Mostra | Estado vazio |
|---|---|---|
| Disponível | Renda prevista − gasto − comprometido | "Adicione a sua primeira conta" |
| Entrou/Saiu/Sobrou | Totais do período | zeros com convite a registar |
| Vencimentos | Próximos 7 dias | desaparece se não houver |
| Gastos por categoria | Top 6 + "outros" | "Sem despesas este mês" |
| Receita por fonte | Ordenado / Entregas / … | "Adicione uma fonte de rendimento" |
| Evolução do saldo | 6 meses | precisa de 2 meses; senão explica |
| Veículo | km, €/km, custo do mês, lucro das entregas | "Ainda sem dados suficientes" |
| Orçamento | % usado, categorias acima | "Criar orçamento" |
| Metas | anéis | "Definir uma meta" |
| Património | ativos − passivos | só aparece se o módulo estiver ligado |

### Filtros de período

`Hoje · Semana · Mês · Trimestre · Semestre · Ano · Personalizado`

Um único componente (`<PeriodPicker>`) e um único helper (`lib/period.ts`) que devolve `{from, to, label, previous}`. O `previous` serve para todas as comparações ("+12% vs mês anterior") — calculado num sítio só, consistente em toda a app.

Estado do período guardado na URL (`?de=2026-08-01&ate=2026-08-31`) — assim os links são partilháveis e o botão "voltar" funciona.

---

## 9. Estrutura das páginas

| Rota | O que é | Notas |
|---|---|---|
| `/` | Dashboard | acima |
| `/movimentos` | Lista com pesquisa e filtros | scroll infinito, agrupado por dia, swipe para editar/apagar |
| `/movimentos/novo` | Formulário completo | o sheet rápido cobre 90% dos casos |
| `/contas` | Contas + saldos | arrastar para reordenar |
| `/contas/[id]` | Extrato de uma conta | |
| `/categorias` | Árvore de categorias | criar personalizadas, arquivar, fundir |
| `/orcamento` | Planeado vs real | barras, arrastar limites |
| `/trabalho` | Fontes de rendimento | cada uma com o seu histórico e o seu P&L |
| `/trabalho/sessoes` | Sessões de entregas | registo rápido: km início/fim → receita |
| `/trabalho/sessoes/nova` | Registar turno | o fluxo mais otimizado depois do `+` |
| `/trabalho/clientes` | Contrapartes | Pizzaria X, condições de pagamento |
| `/veiculos` | Veículos | |
| `/veiculos/[id]` | Ficha do veículo | km, abastecimentos, manutenção, €/km, gráficos |
| `/veiculos/[id]/abastecer` | Registo de combustível | litros + preço + km → consumo |
| `/metas` | Metas financeiras | |
| `/dividas` | Dívidas e empréstimos | plano de amortização |
| `/relatorios` | Relatórios | mensal, anual, por categoria, por veículo, fluxo de caixa |
| `/assistente` | Chat com IA | |
| `/definicoes` | Perfil, segurança, moeda, exportação, tema | |
| `/definicoes/seguranca` | Sessões ativas, palavra-passe, 2FA | |
| `/definicoes/dados` | Exportar tudo, importar CSV, apagar conta | |

---

## 10. Fluxos principais do utilizador

### A. Primeira utilização (o momento que decide se a app é usada)

```
Registo
  → "Quanto tens agora?" — cria 1ª conta com saldo atual (1 campo)
  → "De onde vem o teu dinheiro?" — Ordenado €920 (opcional)
  → "Usas veículo para trabalhar?" — sim → Honda PCX (opcional)
  → Dashboard, já com alguma coisa lá dentro
```

Três perguntas, todas saltáveis. Nunca um dashboard vazio sem explicação.

### B. Registar uma despesa (o gesto mais repetido)

```
[+] → Despesa → 12,40 → Alimentação → [Guardar]
```

Data = hoje, conta = a última usada, tudo pré-preenchido. 3 toques.

### C. Registar um turno de entregas (o fluxo diferenciador)

```
Trabalho → [Novo turno]
  Cliente:      Pizzaria X          (memoriza o último)
  Veículo:      Honda PCX           (memoriza)
  Km início:    24.150
  Km fim:       24.300
  ─────────────────────────────────────────
  150 km × 0,40 €/km = 60,00 €      ← calculado ao vivo
  Custo estimado (150 × 0,082)  −12,30 €
  ─────────────────────────────────────────
  Lucro estimado                 47,70 €
  [Guardar]
```

Ao guardar, cria automaticamente:
- a receita de €60 na fonte "Entregas"
- a leitura de conta-quilómetros
- a ligação ao veículo (para o custo/km futuro)

O custo **não** é lançado como despesa aqui — o combustível é lançado quando se abastece. Lançar os dois seria contar o mesmo custo duas vezes. O `−12,30 €` é uma **imputação analítica**, mostrada mas não contabilizada. Isto está explicado na interface com um `ⓘ`.

### D. Perguntar à IA

```
"Quanto é que a moto me custou este mês?"
  → ferramenta getVehicleCosts(vehicleId, período)
  → "Em agosto a Honda PCX custou 84,20 €: 61,40 € de combustível
     (4 abastecimentos, 47,3 L) e 22,80 € de manutenção.
     Percorreu 1.026 km, o que dá 0,082 €/km."
```

Cada número vem de uma ferramenta. Nenhum vem da imaginação do modelo.

---

## 11. Assistente com IA

### Arquitetura: *tool use*, não texto-para-SQL

```
Pergunta do utilizador
       ↓
Claude Opus 5 (@anthropic-ai/sdk, tool use)
       ↓
Escolhe uma ou mais ferramentas tipadas
       ↓
┌──────────────────────────────────────────────────┐
│ getPeriodSummary(de, ate)                        │
│ getSpendingByCategory(de, ate, limite)           │
│ getIncomeBySource(de, ate)                       │
│ getVehicleCosts(veiculoId, de, ate)              │
│ getWorkProfitability(fonteId, de, ate)           │
│ getBudgetStatus(mes)                             │
│ getUpcomingBills(dias)                           │
│ getGoalProgress(metaId?)                         │
│ projectMonthEnd()                                │
│ getNetWorth()                                    │
│ searchTransactions(texto, de, ate, limite)       │
└──────────────────────────────────────────────────┘
       ↓
Cada ferramenta recebe workspaceId DA SESSÃO — nunca do modelo
       ↓
Resultados (números reais) → Claude compõe a resposta
```

### Regras não negociáveis

1. **O modelo nunca escreve SQL** e nunca vê a base de dados. Só chama funções com assinatura fixa.
2. **`workspaceId` vem da sessão.** Não é parâmetro de nenhuma ferramenta. O modelo não tem como pedir dados de outra pessoa, mesmo que lhe peçam.
3. **Sem dados = dizer que não há dados.** O prompt de sistema é explícito, e as ferramentas devolvem `{ hasData: false, reason: "…" }` em vez de zeros — zeros mentem, porque "gastaste 0 €" e "não registaste nada" são coisas diferentes.
4. **Números só de ferramentas.** O prompt proíbe explicitamente calcular ou estimar valores que não vieram de um resultado de ferramenta.
5. **Projeções são rotuladas.** "Se continuares assim, gastas ~940 € este mês" aparece sempre com a palavra *estimativa* e com a base do cálculo.

### Privacidade — ponto que exige decisão tua

As perguntas e os resultados das ferramentas (que contêm valores reais) vão para a API da Anthropic. Isto tem de ser:

- **opt-in explícito** nas definições, desligado por omissão;
- explicado em texto simples, não escondido nos termos;
- **desligável** — a app funciona a 100% sem IA;
- sem enviar descrições livres de transações a não ser que a pergunta as exija.

### Custo

`claude-opus-5` com `effort: "low"` ou `"medium"` para perguntas simples. Prompt caching no prompt de sistema e nas definições das ferramentas (só isso corta ~90% do custo de entrada em conversas). Limite mensal de perguntas por plano na fase SaaS.

---

## 12. Estratégia de backup e segurança dos dados

### Aviso sobre o Supabase — a verificar antes de qualquer coisa

O teu único projeto Supabase está **`INACTIVE`** (pausado). No plano gratuito:

- projetos pausam ao fim de **7 dias** de inatividade e só voltam manualmente;
- **não há backups nenhuns** — zero dias de retenção;
- máximo 2 projetos ativos.

**Duas consequências:**

1. **Verifica se o `ayaha-crm` em produção usa este projeto.** Se usar, está partido ou vai partir. Isto é urgente e independente deste projeto novo. (Não fui investigar mais para não mexer no que é teu — mas devias confirmar hoje.)
2. Para a app financeira, o plano gratuito do Supabase é **inadequado**: uma app que se usa por semanas seguidas com o dinheiro todo lá dentro não pode pausar sozinha nem viver sem backups.

### Recomendação: Neon

| | Neon (grátis) | Supabase (grátis) |
|---|---|---|
| Pausa por inatividade | suspende o *compute* após minutos, **acorda sozinho** em <500 ms | pausa o **projeto** após 7 dias, retoma **manual** |
| Projetos | 100 | 2 |
| Branching (BD por preview de PR) | sim, nativo | não |
| Integração Vercel | direta | via env vars |
| Backups | histórico configurável | nenhum |

Para este caso — app usada com intermitência, deploys frequentes, dados que não se podem perder — o Neon ganha claramente. E se um dia quiseres o Supabase (storage, realtime), a migração é `pg_dump`/`pg_restore`: é Postgres dos dois lados.

### Camadas de backup

```
1. Do fornecedor        histórico do Neon (confirmar retenção do plano escolhido)
2. Próprio, diário      Vercel Cron 04:00 → pg_dump --format=custom
                        → cifrado AES-256-GCM (chave em env, nunca em git)
                        → Cloudflare R2 / Backblaze B2
                        → 30 diários + 12 mensais
3. Exportação do user   botão "Descarregar todos os meus dados" (JSON + CSV)
                        instantâneo, sem esperar por ninguém
4. Antes de migração    dump automático no pipeline, antes de migrate deploy
```

**Um backup que nunca foi restaurado não é um backup.** Ensaio trimestral: restaurar o dump mais recente para uma base descartável, correr `check-invariants.mjs`, registar o resultado em `docs/`. Fica no calendário, não na boa vontade.

### Migrações seguras — lição já paga

A ordem certa (do `deploy-vercel-seguro`):

```
1. prisma migrate deploy   ← ANTES ou JUNTO com o código
2. deploy do código
3. verificação em produção no endereço principal
```

Nunca ao contrário. Código que lê uma coluna que ainda não existe em produção parte o login e ninguém repara logo.

E numa migração que adiciona coluna a linhas existentes, pensar no que acontece às antigas:

```sql
ALTER TABLE "Transaction" ADD COLUMN "scope" TEXT;
-- Tudo o que já lá estava é pessoal até prova em contrário.
UPDATE "Transaction" SET "scope" = 'PERSONAL' WHERE "scope" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "scope" SET NOT NULL;
```

---

## 13. Estratégia de segurança

| Ameaça | Defesa |
|---|---|
| SQL injection | Prisma parametriza tudo. `$queryRaw` só com `Prisma.sql` e revisão explícita. |
| XSS | React escapa por omissão. Zero `dangerouslySetInnerHTML`. CSP restritiva nos headers. |
| CSRF | Server Actions do Next 15+ verificam origem. Cookies `SameSite=Lax`. Route handlers com verificação de origem manual. |
| Sequestro de sessão | Cookie `httpOnly` + `Secure` + prefixo `__Host-`. Rotação no login. Revogação em massa ao mudar palavra-passe. |
| Força bruta no login | Rate limit por IP **e** por email, contadores em Postgres (a Vercel é serverless — memória local não serve). |
| Enumeração de contas | Resposta e tempo idênticos exista ou não a conta. |
| Fuga entre workspaces | Escopo na camada de dados + teste que tenta adulterar o `workspaceId` e prova que falha. |
| Segredos no código | `.env` no gitignore, `env.ts` valida com Zod ao arrancar (a app recusa arrancar sem o que precisa), segredos no Vercel. |
| Dados sensíveis em logs | Logger que redige valores monetários e emails. Nunca `console.log(transacao)`. |
| Dependências | `npm audit` no CI, Dependabot. |
| Modo demo em produção | `DEMO_MODE=true` faz a app **recusar arrancar** em produção e o build falhar — padrão que já usas no AYAHA. |

**O que nunca sai do servidor:** hashes de palavra-passe, tokens, chaves de API. Uma função `paraOCliente()` que constrói o objeto campo a campo, e um teste que faz `expect(JSON.stringify(resposta)).not.toContain("argon2")`.

---

## 14. Estratégia GitHub / Vercel

### Estado atual e o que fazer

- **Vercel:** equipa `mateusdadiva16-5627s-projects`, 2 projetos existentes. Criar um **terceiro**, novo. Não tocar nos outros.
- **GitHub:** utilizador `MatreuzDX`. **`gh` CLI não está instalado.**
- **Bloqueio conhecido:** o terminal do agente não tem TTY, por isso o Git Credential Manager não consegue autenticar. **O push inicial tens de o fazer tu**, num PowerShell teu:

  ```bash
  cd C:\Users\Mateus\Desktop\financas; git push -u origin main
  ```

  Alternativa: instalar o `gh` (`winget install GitHub.cli`) e fazer `gh auth login` uma vez — depois eu já consigo.

### Pipeline

```
branch de funcionalidade
   → push
   → GitHub Actions: typecheck · lint · test · build
   → Vercel Preview + branch Neon própria (dados isolados)
   → PR + revisão
   → merge em main
   → migrate deploy → build → produção
   → verificação pós-deploy
```

### Verificação pós-deploy — não basta o Vercel dizer "READY"

`READY` só quer dizer que compilou. A checklist (do `deploy-vercel-seguro` e do `verificar-a-serio`):

- [ ] `curl` ao **endereço principal** confirma algo que só existe na versão nova
- [ ] `/entrar` responde 200; `/` sem sessão responde 307 para `/entrar`
- [ ] rotas apagadas devolvem 404
- [ ] consola do browser sem erros
- [ ] 375px sem scroll lateral nem texto cortado
- [ ] modo escuro legível (o bug do preto-sobre-preto do AYAHA)
- [ ] um movimento criado à mão aparece com o valor certo
- [ ] `check-invariants` verde contra a base de produção
- [ ] dados de teste limpos

### Commits

Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`), um por unidade lógica. `AGENTS.md` e `docs/PROXIMO-PASSO.md` atualizados no mesmo commit que a funcionalidade — para o próximo agente (ou o próximo tu, daqui a três meses) saber onde está.

---

## 15. Plano de testes

**Premissa, aprendida à força:** typecheck, lint e testes verdes **não provam nada** sobre produção. Todos os erros registados nas AYAHA-SKILLS passaram os três.

| Nível | Ferramenta | O que cobre |
|---|---|---|
| Unitário | Vitest | `money.ts` (testes de **propriedade**: somas comutam, arredondar uma vez ≠ arredondar N vezes, nunca perde cêntimos), recorrências, custo/km, amortização, `period.ts` |
| Integração | Vitest + **Postgres real** (embedded, uma fixture por teste) | constraint de soma-zero, imutabilidade da auditoria, isolamento entre workspaces, atomicidade de transferências, cache de saldos |
| Invariantes | script próprio | soma dos saldos = soma dos lançamentos; nenhuma transação desequilibrada; nenhum órfão. Corre no CI **e** semanalmente em produção |
| E2E | Playwright | registo → login → despesa → receita → turno de entregas → dashboard mostra o lucro certo. A 375px **e** a 1280px. Modo claro **e** escuro |
| Acessibilidade | axe no Playwright | contraste, foco, labels, navegação por teclado |
| Manual | checklist | ver secção 14 |

**Os testes que mais valem a pena** (escrevo-os cedo, não no fim):

```ts
it("nunca cria movimentos noutro workspace, mesmo com input adulterado", …)
it("uma transferência não altera receitas nem despesas", …)
it("150 km a 0,40 €/km dá exatamente 60,00 € — não 59,99 nem 60,01", …)
it("uma transação SCHEDULED não entra no saldo", …)
it("apagar uma transação não a remove da auditoria", …)
it("o hash da palavra-passe nunca aparece numa resposta", …)
```

---

## 16. Roadmap por fases

Cada fase termina com: testes verdes, deploy verificado em produção, `PROXIMO-PASSO.md` atualizado. Nenhuma fase começa antes da anterior estar mesmo fechada.

| Fase | O quê | Entrega |
|---|---|---|
| **0 — Fundação** | Repo, CI, Postgres local, Prisma, schema base, Better Auth, workspace, deploy vazio a funcionar | Consigo entrar e ver uma app vazia mas real em produção |
| **1 — Núcleo** | Contas, categorias, movimentos, transferências, livro de lançamentos, saldos, constraint de soma-zero, auditoria | Registo dinheiro e os saldos batem certo |
| **2 — Ver** | Dashboard, gráficos, filtros de período, lista de movimentos, PWA, modo escuro, estados vazios | Deixa de ser um formulário e passa a ser uma app |
| **3 — Planear** | Recorrências, contas a pagar/receber, orçamento mensal | Sei o que vem aí e quanto posso gastar |
| **4 — Trabalhar** ⭐ | Fontes de rendimento, clientes, veículo, km, combustível, manutenção, custo/km, sessões de trabalho, lucro real | **O módulo que justifica o produto** |
| **5 — Analisar** | Metas, dívidas + amortização, relatórios, exportação CSV/PDF, anexos de recibos | Consigo mostrar a alguém e exportar |
| **6 — IA** | Assistente com tool use, opt-in, limites | Pergunto e ele responde com os meus números |
| **7 — Endurecer** | 2FA, passkeys, backups automatizados + ensaio de restauro, exportação total, notificações | Confio o suficiente para depender disto |
| **8 — SaaS** | Landing, planos, limites, Stripe, trial, convites, admin | Vende-se |

**A fase 4 é a que diferencia.** Se o tempo apertar, é preferível cortar a 5 e a 6 do que a 4.

---

## 17. As cinco lições do AYAHA, aplicadas

| Lição | Como está incorporada aqui |
|---|---|
| `deploy-vercel-seguro` | Migração antes do código (secção 12). Checklist pós-deploy no endereço principal (14). Postgres local sem Docker em UTF8 na 5433 (2). |
| `duas-zonas-de-confianca` | `workspaceId` sempre da sessão, nunca parâmetro (3). Três barreiras, o proxy não é a única (7). Prefixo de rota com separador (7). Mudar palavra-passe apaga sessões (6). Hash nunca sai do servidor (13). |
| `verificar-a-serio` | Testes de integração contra Postgres real, não mocks (15). Verificação a 375px e em modo escuro (14). "Não consegui confirmar" em vez de "está feito". Data confirmada no relógio, não no contexto. |
| `honestidade-no-produto` | Custo/km só quando há dados; senão diz que faltam (5.5). Sem cotações de investimentos inventadas. Estados vazios que convidam (8). Formulários que não apagam o que se escreveu. Depreciação desligada por omissão. |
| `contexto-ayaha` | Este documento é o equivalente: o contexto que não se lê no código. |

---

## 18. Riscos técnicos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Erros de arredondamento acumulados em cêntimos | Média | **Alto** — números errados destroem a confiança | Inteiros sempre, módulo único, testes de propriedade, `check-invariants` |
| 2 | Partidas dobradas complicam demais a interface | **Alta** | Médio | UI fala Despesa/Receita/Transferência; um só módulo traduz; protótipo do formulário na fase 1 antes de continuar |
| 3 | BD pausada ou perdida (Supabase grátis) | **Alta** se ficarmos no Supabase | **Crítico** | Neon + backup próprio + ensaio de restauro |
| 4 | Push para GitHub bloqueado (sem TTY) | **Certa** | Baixo | Tu fazes o primeiro push, ou instalas o `gh` |
| 5 | Fuga de dados entre workspaces | Baixa | **Crítico** | Escopo na camada de dados + teste de adulteração + revisão focada |
| 6 | Cold start do Neon a atrasar a app | Média | Baixo | <500 ms, e o dashboard é Server Component com cache curta |
| 7 | Custo da API da Anthropic a fugir | Média | Médio | Opus 5 com effort baixo, prompt caching, limite por plano, IA opcional |
| 8 | Recorrências duplicadas ou em falta (fusos, meses de 31 dias, DST) | **Alta** | Médio | Chave de idempotência `(ruleId, occurrenceDate)`; tudo em `Europe/Lisbon`; testes com 29/02, 31 e mudança de hora |
| 9 | Complexidade a matar o projeto antes da fase 4 | **Alta** | **Alto** | Fases pequenas, cada uma em produção; cortar 5 e 6 antes de 4 |
| 10 | Dependência do Better Auth (biblioteca nova) | Baixa | Médio | Dados nas minhas tabelas; testes de isolamento independentes da biblioteca |
| 11 | Armadilha do `null` nos helpers de escopo do Prisma | Média | Alto | Documentada no `AGENTS.md`; helper que rejeita `undefined` explicitamente |
| 12 | Cache de saldos a divergir dos lançamentos | Média | Alto | Atualizado na mesma transação SQL; `check-invariants` no CI e em produção |

---

## 19. Melhorias que sugiro (não estavam no pedido)

### 19.1 Impostos — a maior lacuna, e a que mais dinheiro vale

Se fazes entregas em Portugal, provavelmente tens atividade aberta. Isso implica:

- **IRS**: retenção na fonte ou pagamentos por conta
- **Segurança Social**: contribuição trimestral sobre o rendimento relevante
- **IVA**: se aplicável ao teu enquadramento

Uma app que diz "lucraste €47,70" quando na verdade vais entregar uma parte disso ao Estado **está a mentir**, mesmo sem querer. É exatamente o erro conceptual que o teu pedido quer evitar, um nível acima.

**Sugestão:** módulo *Impostos* que reserva automaticamente uma percentagem configurável de cada receita profissional para uma "conta virtual de impostos", e mostra dois números:

```
Lucro da atividade          47,70 €
Reserva p/ impostos (25%)  −11,93 €
─────────────────────────────────
Realmente teu               35,77 €
```

A percentagem é definida por ti (a app não dá conselhos fiscais e diz isso claramente). Fase 5.

### 19.2 Outras sugestões

| Sugestão | Porquê | Fase |
|---|---|---|
| **Importar CSV do banco** | Registar tudo à mão cansa e a app é abandonada ao fim de 3 semanas. Importar + categorizar por regras resolve. | 5 |
| **Regras de categorização** | "Se a descrição contém 'PINGO DOCE' → Supermercado". Poupa 80% do trabalho manual. | 5 |
| **Anexar foto do recibo** | Câmara do telemóvel, um toque. Sem OCR na v1 — OCR é fase 8+. | 5 |
| **Widget/atalho para registo rápido** | Share target da PWA + atalho no ecrã inicial. | 7 |
| **Comparação com meses anteriores em tudo** | "+12% vs julho" ao lado de cada número dá contexto de graça. | 2 |
| **Modo "só ver"** | Para mostrar contas a alguém sem risco de estragar. | 7 |
| **Alertas úteis, não spam** | Só 3: conta a vencer, categoria acima do orçamento, saldo a chegar ao fim. | 3 |
| **Reconciliação** | "O banco diz 412,30 €, a app diz 409,80 €" → lançamento de ajuste com nota. | 5 |

### 19.3 O que deliberadamente NÃO fica na v1

Digo isto para não haver expectativa errada:

- **Open Banking / PSD2** — caro, burocrático, meses de certificação
- **Cotações de investimentos ao vivo** — sem API paga, seria inventar preços
- **Multi-moeda com conversão** — estrutura preparada, funcionalidade fechada
- **OCR de recibos**
- **App nativa** — a PWA cobre tudo o que precisas
- **Partilha em casal / familiar** — o modelo de workspace suporta, a UI vem na fase 8

---

## 20. Decisões que preciso de ti antes de começar

| # | Decisão | Recomendação | Impacto se mudar depois |
|---|---|---|---|
| 1 | **Pasta do projeto** | `C:\Users\Mateus\Desktop\financas` — a `Desktop\chat` é a pasta genérica de trabalho, não um sítio para um projeto | Baixo (mover é fácil) |
| 2 | **Base de dados** | **Neon** (secção 12) | Médio (dump/restore) |
| 3 | **Autenticação** | **Better Auth** ou repetir o padrão do AYAHA à mão (secção 6) | **Alto** — decidir agora |
| 4 | **Partidas dobradas** | Sim (secção 5.1) — é mais trabalho mas é a diferença entre números certos e números plausíveis | **Muito alto** — não se muda depois |
| 5 | **Nome do produto** | Preciso de um, nem que seja provisório | Baixo |
| 6 | **Módulo de impostos** | Recomendo incluir na fase 5 | Médio |
| 7 | **Push para o GitHub** | Fazes tu, ou instalas o `gh` para eu fazer | Baixo |

E o aviso separado, que não tem a ver com este projeto mas é urgente:

> **O teu projeto Supabase está pausado.** Confirma se o `ayaha-crm` em produção depende dele.

---

## 21. Revisão crítica — as perguntas que fiz a mim próprio

**Falta alguma funcionalidade importante?** Faltava impostos (19.1) e importação bancária (19.2). Ambas adicionadas. Faltava também um plano para *reconciliação* — a app diverge do banco mais cedo do que se pensa.

**Existe alguma vulnerabilidade?** A maior seria fuga entre workspaces. Resolvida por construção (o `workspaceId` não é parâmetro) e provada por teste. A segunda é a IA — resolvida limitando-a a ferramentas tipadas e tornando-a opcional.

**A base suporta crescimento?** Sim. `workspaceId` em tudo desde o primeiro dia; índices compostos pelos padrões de consulta reais; saldos em cache com verificação de invariantes. O que rebentaria primeiro seria a agregação do dashboard com >100k movimentos — resolve-se com vistas materializadas quando (e se) chegar lá.

**A experiência móvel está adequada?** É o desenho principal, não uma adaptação. Barra de navegação fixa, botão `+` central, sheets em vez de modais, 3 toques para registar uma despesa.

**O sistema separa dinheiro pessoal de profissional?** Sim, em dois eixos: `scope` em cada movimento e `IncomeSource` para as fontes. O dashboard filtra por qualquer um.

**Os cálculos são confiáveis?** Cêntimos inteiros, um módulo, testes de propriedade, constraint na base de dados, script de invariantes a correr em produção.

**Há risco de contar receita como lucro?** Era o risco número um. Eliminado estruturalmente: transferências não mexem no lucro (linhas ASSET↔ASSET), custos ligam-se à atividade, e o ecrã de sessão de trabalho mostra sempre receita → custo → lucro, nessa ordem.

**Recorrentes, edições, histórico, backup?** Secções 5.6, 5.7 e 12.

**O que me preocupa mais?** Não é técnico. É o risco 9: a app ficar grande demais e nunca chegar à fase 4, que é a única parte que não existe em mais lado nenhum. Por isso as fases são pequenas e cada uma vai para produção.

---

*Fim do plano. Nenhum código foi escrito. À espera das decisões da secção 20.*
