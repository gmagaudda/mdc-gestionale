import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          for (const item of items) {
            cookieStore.set(item.name, item.value, item.options);
          }
        } catch {
          // Server Components cannot write cookies; proxy refreshes the session.
        }
      },
    },
  });
}
