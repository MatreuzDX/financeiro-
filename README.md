# Financeiro

Gestão financeira pessoal e profissional. Controla o dinheiro do dia a dia e o
do trabalho, e responde à única pergunta que interessa: **quanto é que sobrou
mesmo?**

O caso que guia o desenho: alguém com ordenado fixo que também faz entregas de
mota. A pizzaria paga €0,40/km e ele fez 150 km. Um sistema mal feito diz
"ganhaste €60". Este diz:

```
Receita da sessão                              60,00 €
Custo do veículo (150 km × 0,082 €/km)        −12,30 €
─────────────────────────────────────────────────────
Lucro da atividade                             47,70 €
```

E sabe explicar de onde vem aquele `0,082 €/km` — ou diz que ainda não há
dados suficientes para o calcular, em vez de inventar um número.

## Arranque rápido

```bash
npm install
cp .env.example .env      # e preencher SESSION_SECRET e ADMIN_EMAIL
npm run db:start          # Postgres local, sem Docker, na porta 5434
npm run db:migrate
npm run setup:admin       # mostra UMA vez uma palavra-passe forte
npm run dev
```

Para dados de demonstração (só em desenvolvimento):

```bash
npm run db:seed
```

`SESSION_SECRET` gera-se com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unitários + integração contra Postgres real) |
| `npm run db:start` / `db:stop` / `db:reset` | Postgres local |
| `npm run db:migrate` / `db:deploy` | Migrações |
| `npm run db:seed` | Dados de demonstração |
| `npm run setup:admin` | Cria o administrador inicial |
| `npm run reset-password -- email@x.pt` | Define palavra-passe nova pelo terminal |
| `npm run check:invariants` | Verifica que os números batem certo |

## Como está construído

- **Next.js 16** (App Router, React 19, TypeScript estrito), **Tailwind 4**
- **Prisma 7** + **PostgreSQL**
- Autenticação própria: argon2id, sessões em base de dados, cookie httpOnly
- **Recharts** para os gráficos, **Zod** para validação
- **Vitest**; os testes de integração correm contra Postgres a sério, não mocks

### O livro de lançamentos

Cada movimento tem 2 ou mais linhas que **somam sempre zero** — garantido por
um trigger na base de dados, não por confiança no código.

| | Conta | Categoria |
|---|---|---|
| Despesa 50 € | −5000 | +5000 |
| Receita 920 € | +92000 | −92000 |
| Transferência 200 € | −20000 na origem, +20000 no destino | nenhuma |

A transferência não toca em categoria nenhuma — por isso **não** mexe em
receitas, despesas nem lucro. É essa a razão de todo este trabalho.

O utilizador nunca vê "débito" nem "crédito": vê Despesa, Receita e
Transferência.

### Dinheiro

Tudo em **cêntimos inteiros**. Nunca vírgula flutuante. As taxas (€/km, €/L)
entram como inteiros escalados e o arredondamento acontece uma só vez, no fim.
Toda a aritmética passa por `src/lib/money.ts`.

## Documentação

- [`docs/PLANO-ARQUITETURA.md`](docs/PLANO-ARQUITETURA.md) — o plano completo
- [`AGENTS.md`](AGENTS.md) — armadilhas já pagas neste projeto
