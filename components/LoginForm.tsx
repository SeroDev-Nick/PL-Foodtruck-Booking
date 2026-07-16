"use client";

import { useActionState } from "react";
import { signIn, type SignInResult } from "@/app/login/actions";

const fieldClassName =
  "min-h-11 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-base text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const buttonClassName =
  "flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-2 text-base font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    signIn,
    null as SignInResult | null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          className={fieldClassName}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={fieldClassName}
        />
      </label>

      {state && !state.ok ? (
        <p
          className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button type="submit" className={buttonClassName} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
