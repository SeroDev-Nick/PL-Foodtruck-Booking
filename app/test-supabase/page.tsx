import { createClient } from "@/lib/supabase/server";

export default async function TestSupabasePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").select("*");

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="mb-4 text-2xl font-semibold">Supabase Connection Test</h1>
      <p className="mb-6 text-sm text-gray-600">
        Temporary page to confirm the app can query the bookings table. Safe to
        delete later.
      </p>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Connection failed</p>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      ) : (
        <div className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
          <p className="font-medium">Connection successful</p>
          <p className="mt-2 text-sm">
            Retrieved {data?.length ?? 0} booking
            {(data?.length ?? 0) === 1 ? "" : "s"}.
          </p>
          {data && data.length > 0 && (
            <pre className="mt-4 overflow-x-auto rounded bg-white p-3 text-xs text-gray-800">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </main>
  );
}
