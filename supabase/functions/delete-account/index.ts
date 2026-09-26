// Deletes the calling user's account (App Store guideline 5.1.1(v)).
// Rows in user_data / push_tokens / notification_preferences cascade from auth.users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing bearer token" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);

  const userId = userData.user.id;
  await admin.from("user_data").delete().eq("user_id", userId);
  await admin.from("push_tokens").delete().eq("user_id", userId);
  await admin.from("notification_preferences").delete().eq("user_id", userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[delete-account] deleteUser failed:", deleteError.message);
    return json({ error: "Could not delete account" }, 500);
  }
  return json({ deleted: true });
});
