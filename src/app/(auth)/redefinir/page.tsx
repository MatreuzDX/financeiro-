import type { Metadata } from "next";
import Link from "next/link";
import { Card, ErrorBanner } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Definir palavra-passe nova" };

export default async function RedefinirPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card className="animate-rise space-y-4">
        <ErrorBanner>
          Este link não é válido. Peça uma recuperação nova.
        </ErrorBanner>
        <p className="text-center text-xs">
          <Link href="/recuperar" className="text-primary hover:underline">
            Pedir novo link
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="animate-rise">
      <h2 className="text-sm font-semibold text-ink">Palavra-passe nova</h2>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-muted">
        Ao definir uma palavra-passe nova, todas as sessões abertas são
        fechadas — incluindo em dispositivos que já não tem consigo.
      </p>
      <ResetForm token={token} />
    </Card>
  );
}
