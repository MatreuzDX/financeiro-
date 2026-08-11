import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { htmlClassForTheme, isThemeChoice, THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "Financeiro",
    template: "%s · Financeiro",
  },
  description:
    "Gestão financeira pessoal e profissional: receitas, despesas, veículos, trabalhos e lucro real.",
  applicationName: "Financeiro",
  appleWebApp: { capable: true, title: "Financeiro", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // O tema é decidido no servidor, a partir do cookie. Sem isto haveria um
  // clarão branco antes de o JavaScript arrancar — em modo escuro, de noite,
  // é desagradável ao ponto de as pessoas repararem.
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  const htmlClass = htmlClassForTheme(isThemeChoice(raw) ? raw : "system");

  return (
    <html lang="pt-PT" className={htmlClass} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
