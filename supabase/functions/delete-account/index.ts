import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function listOwnedFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  const folders: string[] = [prefix];

  while (folders.length > 0) {
    const current = folders.pop()!;
    let offset = 0;

    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(current, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        if (/not found|does not exist/i.test(error.message)) break;
        throw new Error(`Could not list ${bucket}: ${error.message}`);
      }

      for (const entry of data ?? []) {
        const path = `${current}/${entry.name}`;
        if (entry.id) files.push(path);
        else folders.push(path);
      }

      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }

  return files;
}

async function removeOwnedFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<void> {
  const files = await listOwnedFiles(admin, bucket, userId);
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await admin.storage
      .from(bucket)
      .remove(files.slice(index, index + 100));
    if (error) throw new Error(`Could not remove ${bucket}: ${error.message}`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Account deletion is not configured" }, 503);
  }

  const authenticatedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await authenticatedClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = authData.user.id;

  try {
    await Promise.all([
      removeOwnedFiles(admin, "profile-avatars", userId),
      removeOwnedFiles(admin, "kyc-documents", userId),
      removeOwnedFiles(admin, "property-images", userId),
    ]);

    // These two audit fields intentionally use RESTRICT so that normal profile
    // deletion cannot erase CRM history accidentally. An explicit account
    // deletion request is the authorized exception.
    const { error: appointmentError } = await admin
      .from("appointment_requests")
      .delete()
      .or(`prospector_user_id.eq.${userId},created_by.eq.${userId}`);
    if (appointmentError && !/does not exist/i.test(appointmentError.message)) {
      throw new Error(`Could not remove appointments: ${appointmentError.message}`);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("[delete-account]", error);
    return jsonResponse(
      { error: "We could not complete the account deletion request" },
      500,
    );
  }
});
