export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)]">
        Dashboard
      </h1>
      <p className="text-base leading-relaxed text-[var(--page-muted)]">
        You are signed in. Truck management tools will appear here next.
      </p>
    </main>
  );
}
