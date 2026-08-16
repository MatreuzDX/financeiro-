# Estudo de mercado e 45 atualizações

Agosto de 2026. Pesquisa em fontes públicas — NerdWallet, Engadget, Reddit
(r/personalfinance, r/ynab), comparativos de Firefly III e Actual Budget,
documentação da Segurança Social e do Portal das Finanças, estudos académicos
sobre gamificação, e a imprensa portuguesa (DECO Proteste, ECO, Doutor
Finanças, PwC Guia Fiscal 2026).

O objetivo não foi listar funcionalidades bonitas. Foi responder a uma
pergunta: **porque é que alguém escolheria esta app em vez do Monarch, do
Copilot ou de uma folha de Excel?**

---

## 1. O que o mercado faz — e o que não faz

### Os números que interessam

| Facto | Fonte | O que significa para nós |
|---|---|---|
| **26%** dos utilizadores continuam depois do 1.º dia. Ao 30.º dia, **4,5%** | benchmarks SaaS 2026 | O problema não é arranjar utilizadores, é o primeiro dia |
| **75%** abandona na primeira semana | idem | A primeira semana é o produto |
| Onboarding personalizado: **+40%** de retenção; **+52%** ao 30.º dia | idem | O `/comecar` adaptado ao perfil já foi a aposta certa |
| Quem tem uma "vitória rápida": **+80%** de retenção | idem | Falta a vitória rápida |
| **84%** sente stress por não saber para onde vai o dinheiro | NerdWallet 2026 | É esta a dor, não "fazer orçamentos" |
| Streaks: **+41%** em depósitos de poupança a 6 meses — mais eficaz do que dinheiro | estudo comportamental | Barato de construir, muito eficaz |
| SaverLife, 50 000 pessoas: pontos e medalhas → **+550 $/ano** poupados | estudo de campo | Gamificação funciona quando premeia o HÁBITO |
| **68%** das apps financeiras já têm IA; **37%** das pessoas já a usam para dinheiro | análise de mercado 2026 | Deixou de ser diferenciador. É expectativa |
| Motoristas: bruto anunciado 25 $/h → real **10–15 $/h** | dados do setor 2026 | O buraco é o custo do veículo, e nós já o medimos |
| Trabalhadores gig deixam **1 500–3 000 $/ano** em cima da mesa por não registarem | idem | Argumento de venda direto |

### Os concorrentes, um a um

| App | O que faz bem | O que lhes falta / o que roubar |
|---|---|---|
| **YNAB** (109 $/ano) | Método de envelopes que muda comportamento. O mais recomendado no Reddit | Rígido, exige dedicação diária. Caro. Roubar: a *disciplina* de dar destino a cada euro, sem a rigidez |
| **Monarch** (100 $/ano) | Património líquido, **modo casal/família**, importador de CSV | Roubar: já temos os espaços partilhados. Falta o **património por pessoa** |
| **Copilot** (95 $/ano, só Apple) | O mais bonito. IA: categorização, metas inteligentes, **pesquisa em linguagem natural**, previsão | Só Apple, só EUA. Roubar: a IA conversacional ancorada nos dados reais |
| **Cleo** | Interface 100% conversa. Sem painéis | Roubar: a ideia de perguntar em vez de navegar. **Não** roubar: esconder os números atrás de um chat |
| **Rocket Money** | Deteta e cancela subscrições | Roubar: **deteção de subscrições** a partir dos movimentos recorrentes |
| **Firefly III** (grátis) | Partidas dobradas a sério, motor de regras, **reconciliação** | Já temos as partidas dobradas e as regras. **Falta a reconciliação** |
| **Actual Budget** (grátis) | Envelopes com UI moderna, sincronização rápida | Roubar: a rapidez do registo |
| **Gridwise / ShiftTracker** | Para motoristas: **ganho real por hora** depois dos custos | Roubar inteiro. Temos os km, o combustível e os trabalhos — falta a divisão |
| **ATGO** (Autoridade Tributária) | Oficial. Emite faturas-recibo, mostra IVA e retenções do ano | Não faz gestão de dinheiro nenhuma. **Não avisa quanto guardar** |
| **App Artur** (PT) | Diz quanto reservar para IVA, SS e IRS | Só isso. Não é uma app de finanças. **É a prova de que o problema existe e alguém paga por ele** |

### O buraco no mercado

Nenhuma app internacional sabe o que é um **recibo verde**. Nenhuma sabe que a
Segurança Social se paga **trimestralmente** sobre 70% do faturado, nem que o
primeiro ano é isento. O YNAB, o Monarch e o Copilot são todos americanos e
tratam impostos como um problema anual, não como dinheiro que **não é seu** e
está na sua conta a fingir que é.

E é exatamente aí que as pessoas se afundam: fatura-se €2 000, vê-se €2 000 na
conta, gasta-se €2 000 — e em janeiro chega a nota da Segurança Social.

**A app portuguesa que separa o dinheiro que não é seu é a app que se vende.**

---

## 2. Crítica honesta ao que já está construído

### O que está bem, e porquê

1. **As partidas dobradas.** Uma transferência nunca inflaciona o lucro. É
   invisível e é a fundação de tudo.
2. **Cêntimos inteiros.** Nenhum erro de arredondamento é possível.
3. **Os espaços partilhados** chegaram antes de a app precisar deles.
4. **A importação de extratos** com pré-visualização e desfazer.
5. **A honestidade da interface.** "Não enviei nenhum email" em vez de fingir.
6. **147 testes**, e os que interessam testam os erros caros.

### O que está mal — sem desculpas

1. **Não há vitória rápida.** Instala-se, respondem-se 7 perguntas, e depois?
   Um painel com zeros. O estudo diz que isto custa 80% da retenção.
2. **Não há nada que traga a pessoa de volta amanhã.** Sem streak, sem
   resumo semanal, sem notificação. A app espera ser lembrada.
3. **O dinheiro dos impostos está misturado com o dinheiro que é seu.**
   Para quem trabalha a recibos verdes — que é o caso — isto é o defeito
   mais grave que a app tem hoje.
4. **Sabemos os km e o combustível mas não dizemos o ganho por hora.** Temos
   as peças todas e não fazemos a conta que mais interessa a quem entrega.
5. **Não há IA nenhuma.** 68% do mercado tem. A `/analise` são nove regras
   fixas — boas, mas não respondem a uma pergunta.
6. **Não há reconciliação.** A app diverge do banco e ninguém dá por isso.
7. **As subscrições não são detetadas.** O Rocket Money construiu um negócio
   inteiro nisto e nós temos os dados.
8. **Não se pode apagar a conta.** RGPD, e o mínimo decente.
9. **Sem recuperação de palavra-passe por email.** Esquece-se, perde-se tudo.
10. **Sem 2FA.** São finanças.

---

## 3. As 45 atualizações

Esforço: **P** pequeno, **M** médio, **G** grande.
Estado: ✅ feito · ◐ parcial, com a diferença explicada · 📅 por fazer

### A — Motor fiscal português (o diferenciador)

> Nenhum concorrente internacional faz isto. É a razão para a app existir
> em Portugal e não ser mais um clone do Monarch.

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 1 | **Perfil fiscal** — regime (dependente / independente / isento art. 53.º / IVA normal), 1.º ano de atividade, coeficiente | Sem isto, qualquer conta de impostos é adivinhação | M | ✅ |
| 2 | **Reserva automática por recibo** — a cada receita profissional, calcula IVA + SS + IRS a guardar | O dinheiro que não é seu deixa de parecer seu | G | ✅ |
| 3 | **Conta "Impostos a pagar"** — cofre virtual, fora do saldo disponível | Ver €2 000 quando só €1 300 são seus é a origem do problema | M | ◐ de outra maneira |
| 4 | **Calendário fiscal** — SS trimestral (jan/abr/jul/out), IVA, IRS anual | As datas apanham toda a gente de surpresa | M | ✅ |
| 5 | **Isenção do 1.º ano** de Segurança Social, com contagem dos 12 meses | Quem não sabe, paga a mais. Quem sabe e esquece, leva um susto no 13.º mês | P | ✅ |
| 6 | **Aviso do limite dos €13 500** de IVA, com projeção anual | Ultrapassar sem dar conta muda o regime todo | M | ✅ |
| 7 | **"Quanto é mesmo meu"** — número único no início | A pergunta que a app existe para responder | P | ✅ |

### B — Agente de inteligência artificial

> 68% do mercado já tem. Deixou de ser diferenciador — é o preço de entrada.

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 8 | **Perguntar em português** — "quanto gastei em combustível este ano?" | O Copilot e a Cleo vivem disto | G | ✅ |
| 9 | **Ancorado nos dados reais**, com ferramentas que consultam a base | Um chat que inventa números numa app de dinheiro é pior do que não ter chat | G | ✅ |
| 10 | **Escolhe o gráfico certo** para a pergunta | Foi o pedido explícito. Ninguém sabe que gráfico quer | M | ✅ |
| 11 | **Degrada com dignidade sem chave de API** — responde com as regras locais | A app não pode partir por falta de uma variável de ambiente | M | ✅ |
| 12 | **Nunca inventa: sem dados, di-lo** | A regra que já governa a `/analise` | P | ✅ |
| 13 | **Limite de gastos por mês**, visível | Uma API paga sem limite é uma fatura surpresa | M | ✅ |
| 14 | **Sugestões de perguntas** conforme o que há na conta | Um campo de texto vazio não convida ninguém | P | ✅ |

### C — Ganho real (para quem trabalha com veículo)

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 15 | **Ganho real por hora** — receita menos combustível, desgaste, seguro, impostos | O buraco entre 25 €/h e 12 €/h. Já temos as peças todas | M | ✅ |
| 16 | **Ganho por km** com custo do veículo descontado | Saber se compensa aceitar a entrega | P | ✅ |
| 17 | **Comparar turnos** — manhã vs noite, dia da semana | Onde está o dinheiro que já se está a ganhar | M | ◐ só por dia da semana |
| 18 | **Custo por km do veículo** a partir do consumo real | Já existe; falta pô-lo ao lado da receita | P | ✅ |

### D — Hábito (o que traz de volta amanhã)

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 19 | **Streak de registo** — dias seguidos | +41% em estudos. Mais eficaz do que dinheiro | M | ✅ |
| 20 | **Resumo da semana** — 4 números e uma frase | O ritual que cria o hábito | M | ✅ |
| 21 | **Vitória rápida no primeiro dia** — registar 1 despesa e ver logo o efeito | +80% de retenção | M | 📅 |
| 22 | **Medalhas por hábito, não por saldo** | Premiar o depósito e não o valor. A investigação avisa para isto | P | ✅ |
| 23 | **Registo em 3 toques** — folha rápida sem mudar de página | A ação mais repetida | M | ✅ |
| 24 | **Perdoar um dia** no streak | Um streak que parte à primeira falha desmotiva mais do que motiva | P | ✅ |

### E — Confiança nos números

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 25 | **Reconciliação** — "o banco diz X, a app diz Y" | O Firefly III tem. A app diverge mais cedo do que se pensa | M | 📅 |
| 26 | **Deteção de subscrições** a partir dos padrões | Modelo de negócio inteiro do Rocket Money | M | ✅ |
| 27 | **Deteção de anomalias** — "isto é o dobro do costume" | IA de base, sem API nenhuma | M | ✅ |
| 28 | **Avisos de duplicado** ao registar à mão | O erro mais vulgar | P | 📅 |
| 29 | **Invariantes a correr em produção** | Hoje só no CI | P | 📅 |
| 30 | **Apagar a conta e levar os dados** | RGPD | M | ✅ |

### F — Educação (o pedido de fundo)

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 31 | **Percurso guiado** — 8 lições curtas ligadas aos números da pessoa | Educação abstrata não pega. Com os números dela, pega | G | 📅 |
| 32 | **Explicar cada número** — toca e diz-se como foi calculado | Confiança nasce de perceber | M | 📅 |
| 33 | **Glossário ligado ao texto** | Já existe; falta ligá-lo | P | 📅 |
| 34 | **Regra 50/30/20** aplicada aos números reais | O ponto de partida mais conhecido | P | ✅ |
| 35 | **Fundo de emergência** — quantos meses aguenta | O número que mais tranquiliza ou assusta | M | ✅ |
| 36 | **Simulador "e se"** — e se cortar isto? e se ganhar mais aquilo? | Ensina causa e efeito | M | 📅 |

### G — Vender e distribuir

| # | O quê | Porquê | Esf. | Estado |
|---|---|---|---|---|
| 37 | **Página pública** que explica o que é | Hoje o link leva a um ecrã de login | M | ✅ |
| 38 | **Planos e limites** — grátis, pessoal, equipa | A tabela `Plan` já existe e não faz nada | M | 📅 |
| 39 | **Modo demonstração** com dados falsos | Experimentar sem criar conta. Converte muito | M | 📅 |
| 40 | **Convidar por link** já feito ✅ | Crescimento orgânico | — |
| 41 | **Exportar para o contabilista** — CSV/JSON por trimestre | Quem tem contabilista, adora | P | ✅ |
| 42 | **Relatório em PDF** do mês | Para imprimir, mostrar, arquivar | M | 📅 |
| 43 | **Multi-idioma** (pt-PT e inglês) | Sair de Portugal um dia | G | 📅 |
| 44 | **Notificações** — só três: conta a vencer, orçamento estourado, saldo a acabar | Mais do que três e desligam-se todas | M | 📅 |
| 45 | **Recuperação de palavra-passe por email** | A porta em falta | M | 📅 |

---

## 4. O que fazer primeiro, e porquê

Se só se puder fazer três coisas: **1–7 (fiscal)**, **8–14 (IA)**, **19–24
(hábito)**.

A razão é comercial. O fiscal é o que mais nenhuma app faz e é o que faz
alguém pagar. A IA é o preço de entrada em 2026. O hábito é o que impede que
os outros dois sejam desperdiçados por abandono ao terceiro dia.

## 5. Avisos que ficam registados

- **Nada aqui é aconselhamento fiscal.** As contas de impostos são
  estimativas com as regras públicas de 2026, com as taxas visíveis e
  editáveis. A app diz isto na cara, em cada ecrã fiscal.
- **As taxas mudam todos os anos.** Ficam em constantes num só ficheiro,
  com a data e a fonte ao lado.
- **A IA nunca inventa números.** As respostas saem de ferramentas que
  consultam a base de dados. Sem dados, diz que não sabe.

---

## 6. Estado real no fim desta sessão

Contagem honesta, porque inflacionar aqui não ajuda ninguém a decidir o que
fazer a seguir.

| | Quantas | Quais |
|---|---|---|
| **✅ Feitas** | **28** | 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 30, 34, 35, 37, 41 |
| **◐ Parciais** | **2** | 3 e 17 |
| **📅 Por fazer** | **15** | 21, 25, 28, 29, 31, 32, 33, 36, 38, 39, 42, 43, 44, 45 (e a 40 já existia antes) |

### As duas parciais, e porquê

**#3 — conta "Impostos a pagar".** Não foi criada nenhuma conta virtual. Em
vez disso, a página de Impostos mostra **quanto do saldo é mesmo seu** e o que
está lá dentro que já tem dono. Uma conta a fingir teria de aparecer nos
saldos, nos gráficos e nas transferências, e passaria a mentir em todos esses
sítios — o número resolve o problema real sem sujar o livro de lançamentos.
Quem quiser separar mesmo o dinheiro cria uma conta poupança a sério e
transfere.

**#17 — comparar turnos.** Só está feita a comparação por **dia da semana**.
Manhã contra noite exigiria a hora a que o trabalho começou, e a app regista
apenas a data. Adivinhá-la pelo momento do registo daria "as noites rendem
mais" a quem calha registar à noite — uma resposta errada com ar de certa.
Para a fazer a sério é preciso um campo novo no registo de trabalhos.

### O que fica por fazer, por ordem de valor

1. **#25 reconciliação** — "o banco diz X, a app diz Y". É a única coisa desta
   lista que protege contra a app divergir da realidade sem ninguém dar conta.
2. **#45 recuperação de palavra-passe por email** — precisa de um serviço de
   envio (Resend ou equivalente) e de uma variável de ambiente.
3. **#21 vitória rápida no primeiro dia** e **#31 percurso guiado** — as duas
   maiores alavancas de retenção que sobram.
4. **#38 planos e #39 modo demonstração** — só fazem sentido quando houver
   intenção real de cobrar.
5. **#44 notificações** — exige service worker e permissões; é um lote só para
   ele.
