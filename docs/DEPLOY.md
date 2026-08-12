# Pôr no ar (Vercel + Neon)

**Um passo.** É preciso ligar uma base de dados — o resto está tratado.

A aplicação não pede mais nenhuma variável de ambiente: a ligação à base é
descoberta sozinha (aceita `DATABASE_URL`, `POSTGRES_PRISMA_URL`,
`POSTGRES_URL`, `DATABASE_URL_UNPOOLED` ou `POSTGRES_URL_NON_POOLING`), as
migrações correm no build, e a primeira conta cria-se na própria aplicação.

---

## 1. Ligar a base de dados

No projeto, na Vercel:

**Storage → Create Database → Neon → plano gratuito → Frankfurt**
(ou Londres — as mais perto de Portugal)

A Vercel injeta as variáveis sozinha. Não é preciso copiares palavra-passe
nenhuma para lado nenhum.

## 2. Reconstruir

**Deployments → ⋯ no mais recente → Redeploy.**

Ligar uma base de dados costuma disparar um deploy sozinho; se não disparar,
é este o botão.

O build corre `prisma migrate deploy` **antes** de construir a aplicação. A
ordem é essa de propósito: código que lê uma coluna que ainda não existe
parte o login, e ninguém repara logo.

## 3. Criar a tua conta

Abre `https://<o-teu-projeto>.vercel.app`. Como ainda não existe nenhuma
conta, a app leva-te a **/instalar** e pede nome, email e palavra-passe.

A primeira conta criada fica como proprietária, e essa porta **fecha-se a
seguir** — mais ninguém consegue criar contas por ali. Está protegida por um
bloqueio na base de dados, para dois pedidos ao mesmo tempo não conseguirem
criar dois donos.

Escolhe uma palavra-passe de que te lembres: a recuperação por email ainda
não está configurada (ver limitações, em baixo).

---

## Depois de publicar — verificar a sério

O painel dizer **Ready** só quer dizer que compilou.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<projeto>.vercel.app/instalar   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<projeto>.vercel.app/           # 307
```

E depois, à mão:

- [ ] `/instalar` abre e cria a conta
- [ ] o dashboard abre (vazio, mas sem erro)
- [ ] criar uma conta bancária e um movimento; o saldo muda pelo valor certo
- [ ] `/instalar` já não deixa criar outra conta (manda para `/entrar`)
- [ ] no **telemóvel**, a 375px, sem scroll lateral
- [ ] em **modo escuro**, tudo legível
- [ ] sair e confirmar que `/` volta a mandar para `/entrar`
- [ ] apagar os dados que criaste a testar

## Se alguma coisa falhar

O build pára com mensagens em português a dizer o que falta. Os dois casos
prováveis:

| Mensagem | O que fazer |
|---|---|
| `Falta a ligação à base de dados` | O passo 1 não foi feito, ou a integração não criou nenhuma das variáveis conhecidas. Cria uma `DATABASE_URL` à mão em Settings → Environment Variables. |
| `não parece uma ligação PostgreSQL` | A variável existe mas tem outra coisa lá dentro. Confirma que começa por `postgres://` ou `postgresql://`. |

## Um só projeto por repositório

Se importares o mesmo repositório duas vezes, ficas com dois projetos a
publicar o mesmo código e nunca sabes qual é o teu site. Apaga os que
sobrarem em **Settings → General → Delete Project**.

## O que ainda NÃO está tratado em produção

Dito por escrito para não haver ilusões:

- **Backups próprios.** O Neon tem histórico de recuperação, mas o dump
  diário cifrado para armazenamento externo (secção 12 do plano) não está
  feito.
- **Recuperação de palavra-passe por email.** Não há serviço de envio
  configurado. Até haver, o caminho é `npm run reset-password -- email@x.pt`
  a partir de um computador com a `DATABASE_URL` de produção.
- **Migrações em pré-visualizações.** A integração Neon costuma dar uma
  ramificação da base a cada pré-visualização. Confirma que sim — senão um
  deploy de teste corre migrações contra a base a sério.
