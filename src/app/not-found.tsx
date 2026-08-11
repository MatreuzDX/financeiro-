import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl font-semibold text-ink">404</p>
      <p className="text-sm text-muted">
        Esta página não existe — ou já não existe.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
