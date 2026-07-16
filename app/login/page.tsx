import { LoginForm } from "@/components/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  return (
    <div className="flex flex-1 flex-col bg-[var(--page-bg)]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-3xl">
            Manager sign in
          </h1>
          <p className="text-base leading-relaxed text-[var(--page-muted)]">
            Sign in with the email and password for your manager account.
          </p>
        </header>

        <LoginForm nextPath={nextPath} />
      </main>
    </div>
  );
}
