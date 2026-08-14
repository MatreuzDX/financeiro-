import type { MetadataRoute } from "next";

/**
 * Manifesto da aplicação instalável.
 *
 * Existia como ficheiro estático em `public/`, mas **nunca esteve ligado ao
 * HTML** e tinha a lista de ícones vazia — ou seja, o "adicionar ao ecrã
 * inicial" não funcionava, e mesmo que funcionasse ficava sem ícone.
 *
 * Aqui é gerado pelo Next, que trata de meter o `<link rel="manifest">`
 * sozinho. É o que transforma o site num atalho no telemóvel: abre sem barra
 * de endereço, com ícone próprio, como uma app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Financeiro",
    short_name: "Financeiro",
    description:
      "Gestão financeira pessoal e profissional: receitas, despesas, veículos e lucro real.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-PT",
    dir: "ltr",
    categories: ["finance", "productivity"],
    // Cor do fundo enquanto a app arranca. Escura para não dar um clarão
    // branco a quem a abre de noite.
    background_color: "#0b0f14",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icone.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icone-mascara.svg",
        sizes: "any",
        type: "image/svg+xml",
        // "maskable" deixa o Android recortar o ícone à forma do sistema
        // sem cortar o símbolo — por isso este tem mais margem à volta.
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nova despesa",
        short_name: "Despesa",
        description: "Registar uma despesa",
        url: "/movimentos/novo",
      },
      {
        name: "Registar trabalho",
        short_name: "Trabalho",
        description: "Registar um trabalho ou entrega",
        // `/trabalhos`, NÃO `/trabalhos/novo`: o formulário vive na própria
        // página da lista. Escrevi o atalho para uma rota que não existe e
        // só dei por isso ao testar — um atalho partido no ecrã inicial é
        // pior do que não ter atalho nenhum.
        url: "/trabalhos",
      },
    ],
  };
}
