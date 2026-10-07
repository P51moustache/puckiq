// register-alerts: a device turns scratch and goal alerts on or off for the NHL players it follows.
// Deploy with --no-verify-jwt: no account is involved; the Expo push token identifies the device.
//
//   POST   { token, playerIds, prefs: { scratches, goals }, appVersion?, platform? }  -> { ok: true }
//   DELETE { token }                                                                    -> { ok: true }
//   400 { error } for a bad body (codes in ../_shared/alertRegistration.ts), 500 { error } on a DB error.
//
// Writes alert_devices with the service role (clients cannot read the alert tables). Deleting a
// device also deletes its alert_log rows (foreign key cascade).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  MAX_BODY_BYTES,
  parseRegistration,
  parseUnregistration,
  registrationToRow,
} from "../_shared/alertRegistration.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function readBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false };
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { ok: false };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);

  const read = await readBody(req);
  if (!read.ok) return json({ error: "invalid_body" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (req.method === "DELETE") {
    const parsed = parseUnregistration(read.body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const { error } = await admin.from("alert_devices").delete().eq("expo_push_token", parsed.value.token);
    if (error) {
      console.error("[register-alerts] delete failed:", error.message);
      return json({ error: "server_error" }, 500);
    }
    return json({ ok: true });
  }

  const parsed = parseRegistration(read.body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { error } = await admin
    .from("alert_devices")
    .upsert(registrationToRow(parsed.value, new Date().toISOString()), { onConflict: "expo_push_token" });
  if (error) {
    console.error("[register-alerts] upsert failed:", error.message);
    return json({ error: "server_error" }, 500);
  }
  return json({ ok: true });
});
