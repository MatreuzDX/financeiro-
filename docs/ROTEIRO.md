# Estudo, crítica e roteiro

**2026-08-15** · Mercado: **Portugal** (€, pt-PT)

---

## 1. O que fui ver lá fora

| App | O que faz bem | O que roubei |
|---|---|---|
| **Firefly III** | Partidas dobradas a sério; motor de **regras** que categoriza sozinho | O livro de lançamentos já era assim aqui. As regras: **por fazer (#11)** |
| **Actual Budget** | Orçamento de envelope, interface limpa, rápida | O orçamento por categoria já existe |
| **Maybe Finance** | **Património líquido** como ecrã principal | Por fazer (#6) |
| **Copilot** | Feed "Intelligence": frases sobre os teus números | **Feito** — página Análise |
| **Monarch** | Recorrentes, previsão de fluxo de caixa | **Feito agora** (#1, #2) |
| **YNAB** | Filosofia manual: cada euro tem um destino | Alinha com o que já cá está |

**Queixas que se repetem nas críticas de utilizadores:**

- Atualizações que **acrescentam cliques** e tiram fluxos que já funcionavam.
- Ligação aos bancos que falha (Plaid) — **20 a 30% das pessoas desistem no arranque** por causa disso.
- Apps que mostram gráficos bonitos e não dizem nada de útil.

**O que mais pedem:** recorrentes, contas a pagar, digitalizar recibos, registar dinheiro vivo, património líquido.

---

## 2. Crítica ao que construímos

### O que ficou bom

1. **O livro de lançamentos.** A soma-zero garantida por *trigger* na base de dados, não por confiança no código. Uma transferência não pode inflacionar o lucro nem que se queira. É a decisão mais cara que tomámos e a que mais se paga.
2. **Cêntimos inteiros em todo o lado.** Nunca vai aparecer 59,99 € onde deviam estar 60,00 €.
3. **A honestidade como regra de produto.** O custo por quilómetro só aparece quando há dados; a Análise diz "não sei" em vez de mostrar zeros; recusei inventar consumos de veículos. Isto vai ser o que distingue esta app.
4. **Separar pessoal de profissional.** Quase nenhuma app grátis faz isto, e para quem tem trabalhos por fora é a diferença entre saber e achar.
5. **A página Análise.** Frases em vez de gráficos. É o que a concorrência paga tem.

### O que não gostei — e que ainda está por resolver

1. **Registar uma despesa dá demasiados passos.** É a ação mais repetida da app e obriga a abrir uma página inteira. Devia ser uma folha que sobe por baixo, em três toques. → **#3**
2. **Não há forma de anexar um recibo.** Toda a gente tem o telemóvel na mão quando paga.  → **#12**
3. **Não há importação de extrato.** Registar tudo à mão cansa; ao fim de três semanas abandona-se. É *a* razão de morte destas apps. → **#10**
4. **Sem backups próprios.** O Neon tem histórico, mas nunca fizemos um restauro de teste. Um backup que nunca foi restaurado não é um backup. → **#16**
5. **Sem recuperação de palavra-passe a funcionar.** Está escrito na app que não está configurada — honesto, mas é uma porta em falta. → **#13**
6. **A auditoria não se vê em lado nenhum.** Guardamos tudo e não mostramos nada. → **#20**
7. **Ainda não há forma de apagar a conta e levar os dados.** RGPD, e é o mínimo decente. → **#19**
8. **A `Análise` corre muitas consultas.** Hoje não custa nada; com anos de dados vai custar. → **#22**

---

## 3. As 25 atualizações

**Estado:** ✅ feito nesta sessão · 🔜 próximo · 📅 longo prazo
**Esforço:** S (horas) · M (um dia) · L (vários dias)

### Fazer a app render — o que falta para ser completa

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 1 | **Recorrências** — renda, internet, ordenado criados uma vez | A maior falha face à concorrência. Ninguém escreve a renda 12 vezes por ano | L | ✅ |
| 2 | **Contas a pagar** com atrasos e confirmação | Previsto ≠ pago. O saldo só mexe quando se confirma | M | ✅ |
| 3 | **Registo rápido em 3 toques** — folha por baixo, sem mudar de página | A ação mais repetida da app. Se cansa, a app morre | M | ✅ |
| 4 | **Metas de poupança** com ritmo e previsão | Poupar sem destino não se aguenta | M | ✅ |
| 5 | **Editar um movimento** pela lista | Hoje só dá para apagar e criar de novo | S | ✅ |
| 6 | **Património líquido** — o que tem menos o que deve, ao longo do tempo | É o ecrã principal da Maybe. Dá a visão que falta | M | ✅ |
| 7 | **Dívidas e créditos** com plano de amortização | Separar juros de capital: só assim se sabe o custo real | L | 📅 |
| 8 | **Investimentos** com valor atualizado à mão | Sem cotações inventadas. Só o que a pessoa souber | L | 📅 |

### Tirar trabalho de cima — o que faz a app pegar-se

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 9 | **Duplicar movimento** a partir do histórico | Metade do que se regista já se registou antes | S | ✅ |
| 10 | **Importar extrato do banco (CSV)** com pré-visualização | Sem isto abandona-se ao fim de três semanas | L | ✅ |
| 11 | **Regras de categorização** — "contém PINGO DOCE → Supermercado" | O motor do Firefly III. Poupa 80% do trabalho manual | M | ✅ |
| 12 | **Anexar foto do recibo** | O telemóvel está na mão quando se paga. Sem OCR para já | M | 📅 |
| 13 | **Recuperação de palavra-passe por email** (Resend) | A porta em falta. Hoje só pelo terminal | S | ◐ há recuperação de emergência por variável de ambiente; falta o email |
| 14 | **Notificações** — só três: conta a vencer, categoria acima do orçamento, saldo a acabar | Mais do que isso e desligam-se todas | M | 📅 |

### Confiança — o que não se vê mas evita desastres

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 15 | **Reconciliação** — "o banco diz X, a app diz Y" | A app diverge do banco mais cedo do que se pensa | M | ✅ |
| 16 | **Backup diário cifrado + ensaio de restauro** | Um backup que nunca foi restaurado não é um backup | M | 🔜 |
| 17 | **2FA e passkeys** | São finanças. Palavra-passe sozinha não chega para sempre | M | 📅 |
| 18 | **Invariantes a correr em produção**, semanalmente | Hoje só correm no CI e à mão | S | 🔜 |
| 19 | **Exportar tudo e apagar a conta** | RGPD, e o mínimo decente | S | ✅ exportar / 🔜 apagar |
| 20 | **Ver a auditoria** na própria app | Guardamos tudo e não mostramos nada | S | ✅ |

### Perceber melhor — a continuação da Análise

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 21 | **Análise em palavras** com nove observações + glossário | Um gráfico mostra, uma frase explica | M | ✅ |
| 22 | **Assistente que responde a perguntas** sobre o teu dinheiro | Ferramentas tipadas, nunca SQL do modelo. `workspaceId` da sessão | L | ✅ precisa de ANTHROPIC_API_KEY na Vercel |
| 23 | **Relatório em PDF** para mostrar a terceiros | Contabilista, banco, pedido de crédito | M | 📅 |
| 24 | **Módulo de impostos** — reserva uma % de cada receita profissional | Dizer "lucraste 47,70 €" quando parte vai para o Estado é mentir | M | ✅ |

### Vender

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 25 | **SaaS**: página pública, planos, Stripe, limites, convidar membros | A base já suporta — `workspaceId` em todas as tabelas desde o primeiro dia | L | ◐ página pública e convites feitos; planos e Stripe não |

---

## 4. Ordem que recomendo

**A seguir, por esta ordem:**

1. **#3 registo rápido** e **#9 duplicar** — atacam a fricção diária, que é o que mata estas apps
2. **#5 editar movimento** — falha básica, resolve-se depressa
3. **#10 importar CSV** + **#11 regras** — juntas, tiram 80% do trabalho manual
4. **#13 recuperação por email** — fechar a porta que falta
5. **#6 património** — a visão que falta, e é barata
6. **#16 backups** e **#18 invariantes em produção** — antes de haver dados a sério lá dentro

**Deixar para depois de haver uso real:** #22 assistente, #23 PDF, #24 impostos, #25 SaaS. Construir isso antes de a app ser usada todos os dias é decorar uma casa sem paredes.

---

## 5. Riscos que continuam de pé

| Risco | Estado |
|---|---|
| Abandono por cansaço de registo manual | **Ativo.** Só se resolve com #3, #9, #10, #11 |
| Repositório público | **Ativo.** Falta o código de confirmação do GitHub |
| Sem backups próprios | **Ativo.** #16 |
| Recuperação de palavra-passe inexistente | **Ativo.** #13 — hoje só pelo terminal |
| Neon a suspender por inatividade | Baixo — acorda em <500 ms |
| Custo da API de IA a fugir | Não aplicável ainda (#22 por fazer) |
