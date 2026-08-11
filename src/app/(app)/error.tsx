"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

/**
 * Barreira de erro.
 *
 * Mostra uma mensagem neutra — nunca a mensagem técnica, que pode revelar
 * nomes de tabelas, caminhos de ficheiros ou dados. O detalhe fica na consola
 * do servidor, onde é útil e não é público.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro na página]", error);
  }, [error]);

  return (
    <Card className="mx-auto mt-8 max-w-md text-center">
      <h2 className="text-sm font-semibold text-ink">
        Alguma coisa correu mal
      </h2>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-muted">
        Não foi possível carregar esta página. Os seus dados não foram
        alterados. Tente novamente — se continuar, volte mais tarde.
      </p>
      {error.digest ? (
        <p className="mb-4 text-[10px] text-faint">
          Referência do erro: {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} className="w-full">
        Tentar novamente
      </Button>
    </Card>
  );
}
