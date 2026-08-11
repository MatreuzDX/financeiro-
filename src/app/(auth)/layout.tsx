export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-fg">
            €
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Financeiro
          </h1>
          <p className="text-xs text-muted">
            Gestão financeira pessoal e profissional
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
