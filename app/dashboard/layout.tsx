import { redirect } from "next/navigation";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireManagerSession();
  if (!session.ok) {
    redirect("/login");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--page-bg)]">
      <header className="border-b border-[var(--control-border)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-3 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--page-muted)]">
              Manager dashboard
            </p>
            {session.email ? (
              <p className="truncate text-sm text-[var(--page-fg)]">
                Signed in as {session.email}
              </p>
            ) : null}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
