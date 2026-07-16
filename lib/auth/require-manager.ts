import { createClient } from "@/lib/supabase/server";

export type ManagerSession =
  | { ok: true; userId: string; email: string | undefined }
  | { ok: false; error: string };

/**
 * Server-side session check for manager-only code paths.
 * Call at the start of every sensitive Server Action — never trust the UI alone.
 */
export async function requireManagerSession(): Promise<ManagerSession> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      error: "You need to sign in to continue.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email,
  };
}
