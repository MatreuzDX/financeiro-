# Pôr no ar (Vercel + Neon)

Cinco passos. Os que só tu podes fazer estão marcados com **[tu]** — envolvem
autenticar-te ou lidar com palavras-passe, e isso não delego.

---

## 1. [tu] Enviar o código para o GitHub

O terminal do agente não tem TTY, por isso o Git não consegue autenticar-se a
partir dele. Num PowerShell teu:

```bash
cd C:\Users\Mateus\Desktop\financeiro; git push -u origin main
```

Enquanto lá estás: o repositório `financeiro-` está **público**. Não tem
segredos nenhuns (o `.env` está ignorado e foi verificado), mas as tuas
finanças a sério vão viver nesta app. Em
`Settings → General → Danger Zone → Change visibility` passa-o a privado.

## 2. [tu] Importar o projeto na Vercel

`vercel.com` → **Add New → Project** → escolher `MatreuzDX/financeiro-`.

Não mexer em nada nas definições de build: a Vercel deteta o Next.js sozinha e
o projeto já traz o script `vercel-build` com as migrações. **Não carregar em
Deploy ainda** — sem base de dados, a primeira construção falha.

## 3. [tu] Ligar a base de dados Neon

No projeto recém-criado: **Storage → Create Database → Neon** (no
Marketplace) → plano gratuito → região **Frankfurt** ou **Londres** (as mais
perto de Portugal).

Ao ligar, a Vercel injeta sozinha as variáveis da base — incluindo
`DATABASE_URL`. Não é preciso copiares palavra-passe nenhuma para lado nenhum.

Confirma que existe uma variável chamada exatamente **`DATABASE_URL`**. Se a
integração criar apenas `POSTGRES_URL` ou `DATABASE_URL_UNPOOLED`, cria uma
`DATABASE_URL` em **Settings → Environment Variables** com o mesmo valor da
ligação *pooled*.

## 4. [tu] Duas variáveis de ambiente

**Settings → Environment Variables**, para Production e Preview:

| Nome | Valor |
|---|---|
| `SESSION_SECRET` | gerar com o comando abaixo |
| `ADMIN_EMAIL` | `mateusdadiva16@gmail.com` |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Guarda o `SESSION_SECRET` onde guardas as tuas palavras-passe. Se o mudares,
todas as sessões abertas caem — o que é útil de propósito, um dia.

Agora sim: **Deploy**.

O build corre `prisma migrate deploy` **antes** de o código novo passar a
servir. A ordem é essa de propósito: código que lê uma coluna que ainda não
existe parte o login e ninguém repara logo.

## 5. [tu] Criar a conta de administrador

A Vercel não tem terminal, por isso corre-se de casa contra a base de
produção. Copia a `DATABASE_URL` da Vercel para um ficheiro temporário:

```bash
cd C:\Users\Mateus\Desktop\financeiro
cp .env .env.local-backup
```

Substitui a linha `DATABASE_URL` no `.env` pela de produção e corre:

```bash
npm run setup:admin
```

Aparece **uma vez** uma palavra-passe forte gerada na hora. Guarda-a. Depois
repõe o `.env` local:

```bash
mv .env.local-backup .env
```

Entra em `https://<o-teu-projeto>.vercel.app/entrar` e o sistema obriga-te a
trocar a palavra-passe no primeiro acesso.

---

## Depois de publicar — verificar a sério

O painel dizer **Ready** só quer dizer que compilou.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<projeto>.vercel.app/entrar   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<projeto>.vercel.app/         # 307
```

E depois, à mão:

- [ ] `/entrar` abre e o formulário aparece
- [ ] entrar com a conta de administrador funciona
- [ ] o dashboard abre (vazio, mas sem erro)
- [ ] criar uma conta e um movimento; o saldo muda pelo valor certo
- [ ] no **telemóvel**, a 375px, sem scroll lateral
- [ ] em **modo escuro**, tudo legível
- [ ] sair e confirmar que `/` volta a mandar para `/entrar`
- [ ] apagar os dados que criaste a testar

## O que ainda não está tratado em produção

Dito por escrito para não haver ilusões:

- **Backups próprios.** O Neon tem histórico de recuperação, mas o dump
  diário cifrado para armazenamento externo (secção 12 do plano) não está
  feito.
- **Recuperação de palavra-passe por email.** Não há serviço de envio
  configurado. Até haver, o caminho é `npm run reset-password -- email@x.pt`
  contra a base de produção.
- **Migrações em pré-visualizações.** A integração Neon costuma dar uma
  ramificação da base a cada pré-visualização. Confirma que sim — senão um
  deploy de teste corre migrações contra a base a sério.
