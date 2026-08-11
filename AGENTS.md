# Notas para quem trabalhar neste projeto

Contexto que não se lê no código, e erros que já custaram tempo aqui. Ler
antes de mexer.

## Ambiente

- **Postgres local na porta 5434**, não 5433 — a 5433 é do projeto `ayaha-crm`,
  que costuma estar a correr na mesma máquina. `npm run db:start`.
- **Docker não é opção** nesta máquina (não arranca sem administrador). Usa-se
  `embedded-postgres` como dependência npm.
- A base **tem de ser UTF8**. O `initdb` do Windows herda WIN1252 e a primeira
  migração com um acento rebenta. O `dev-db.mjs` já cria a partir de
  `template0` em UTF8.
- **`client_encoding` também tem de ser UTF8.** O motor de migrações do Prisma
  (Rust) não o corrige sozinho, ao contrário do driver `pg`. Se aparecer
  *"has no equivalent in encoding WIN1252"*, correr `node scripts/fix-encoding.mjs`.
  As migrações devem ser escritas em ASCII sempre que possível.

## Armadilhas já pagas

### 1. Não exportar constantes de um ficheiro `"use client"` para o servidor

O nome do cookie do tema estava exportado de `components/theme.tsx`. Quando o
servidor importa algo de um módulo de cliente, o Next substitui-o por uma
referência que **lança**. O resultado foi `cookies().set(<função>, "dark")` →
cabeçalho inválido → Server Action a responder 500 em silêncio, e a
preferência de tema nunca a ser guardada. Nada aparecia no ecrã, porque a
mudança de tema é aplicada no browser e só desaparecia no recarregamento
seguinte.

**Regra:** valores partilhados entre servidor e cliente vivem num módulo
neutro (`src/lib/theme.ts`), sem `"use client"` e sem `server-only`.

### 2. O proxy não pode decidir com base na validade da sessão

O `proxy.ts` corre no edge e não fala com a base: só sabe se o **cookie
existe**, não se **vale**. Tinha lá um desvio "já tem sessão → vai para o
dashboard", e um cookie inválido punha a app em ciclo infinito: `/` mandava
para `/entrar` (sessão inválida) e o proxy mandava de volta para `/` (cookie
existe). Ninguém conseguia voltar a entrar.

O desvio vive agora na página `/entrar`, que consegue mesmo verificar a
sessão. Há um teste de regressão em `tests/unit/proxy.test.ts`.

### 3. Datas com `date-fns` sobre colunas `@db.Date`

As funções do `date-fns` operam em hora **local**; as colunas `@db.Date` são
lidas e escritas em **UTC à meia-noite**. Misturar as duas dá um erro
silencioso de um dia — `startOfMonth` do dia 1 devolvia o último dia do mês
anterior. Toda a aritmética de datas está em `src/lib/date.ts`, em UTC sobre
strings `YYYY-MM-DD`. **Não usar `date-fns` para datas sem hora.**

### 4. Ler valores monetários escritos por pessoas

`parseAmountToCents("12,345")` chegou a devolver €12 345,00 — mil vezes mais
do que quem escreveu queria. Em pt-PT a vírgula é **sempre** decimal: três
casas é um erro de digitação e recusa-se, não se adivinha. Só o ponto sozinho
é ambíguo ("1.234" = milhar, "12.34" = decimal).

### 5. `-0`

`-(0)` é `-0`, que formata como **"-0,00 €"** e parece um bug. Usar
`negate()` de `src/lib/money.ts`.

### 6. Ambient const enums com `isolatedModules`

`Algorithm.Argon2id` do `@node-rs/argon2` não compila. Está escrito como
`2 as Algorithm`, com comentário.

### 7. Testar com o painel do browser fechado

O React revela o conteúdo em suspense dentro de um `requestAnimationFrame`.
Num separador que não está a compor imagens, isso **nunca corre** e a página
fica eternamente no esqueleto de carregamento — parece um bug e não é. Se
acontecer: confirmar por outro caminho (`curl`, `fetch`, registos do
servidor) antes de investigar código.

## Regras que não se quebram

1. **Nenhuma página fala com o Prisma diretamente.** As páginas chamam
   `src/server/*`.
2. **O `workspaceId` vem SEMPRE da sessão, nunca de um parâmetro.** A
   garantia mais forte não é uma verificação — é a ausência do parâmetro.
   Há testes que tentam adulterar e provam que falha.
3. **Toda a aritmética de dinheiro passa por `src/lib/money.ts`.** Cêntimos
   inteiros, nunca vírgula flutuante.
4. **Valores calculados nunca vêm do formulário.** `grossCents` de um
   trabalho e `totalMetres` de uma quilometragem são calculados no servidor —
   se viessem do cliente, bastava adulterar um campo escondido.
5. **Não inventar números.** Sem dados suficientes, o ecrã diz que faltam
   dados. Um custo/km fabricado é pior do que nenhum, porque leva a decisões
   erradas.

## Verificar antes de dizer que está pronto

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run check:invariants
```

E depois, a sério: abrir a página, clicar, ver a 375px, ver em modo escuro,
confirmar que as rotas protegidas continuam protegidas. Typecheck, lint e
testes verdes **não** provam que funciona — os bugs 1 e 2 desta lista passaram
os três.
