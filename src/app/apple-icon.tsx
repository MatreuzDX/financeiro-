import { ImageResponse } from "next/og";

/**
 * Ícone para o "Adicionar ao ecrã principal" do iPhone.
 *
 * O iOS não aceita SVG aqui — sem um PNG, o atalho fica com uma miniatura
 * da página, que é ilegível num ícone. O Next gera este PNG na construção e
 * mete o `<link rel="apple-touch-icon">` sozinho.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          color: "#ffffff",
          fontSize: 116,
          fontWeight: 700,
        }}
      >
        €
      </div>
    ),
    size,
  );
}
