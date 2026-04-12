import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface InjuryUpdate {
  player_id: number;
  player_name: string;
  status: string; // "DTD" | "IR" | "OUT" | "Healthy"
  suggestion: string; // e.g., "consider benching or picking up Byfield"
}

serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Accept injury updates from request body (sent by sync pipeline or webhook)
    let injuries: InjuryUpdate[] = [];
    try {
      const body = await req.json();
      injuries = body.injuries ?? [];
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must contain { injuries: [...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (injuries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No injury updates provided" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Find all users with injuryAlerts enabled
    const { data: prefRows, error: prefError } = await supabaseClient
      .from("notification_preferences")
      .select("user_id, fantasy_prefs")
      .not("fantasy_prefs", "is", null);

    if (prefError) {
      console.error("[injury-alert] Error loading preferences:", prefError.message);
      return new Response(JSON.stringify({ error: prefError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eligibleUsers = (prefRows ?? []).filter(
      (row: { user_id: string; fantasy_prefs: Record<string, boolean> }) =>
        row.fantasy_prefs?.injuryAlerts === true
    );

    if (eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No eligible users" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Get user data (push tokens + rosters)
    const userIds = eligibleUsers.map((u: { user_id: string }) => u.user_id);
    const { data: userData, error: userError } = await supabaseClient
      .from("user_data")
      .select("user_id, expo_push_token, roster")
      .in("user_id", userIds)
      .not("expo_push_token", "is", null);

    if (userError) {
      console.error("[injury-alert] Error loading user data:", userError.message);
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userData || userData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No users with push tokens" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Build a map of injured player_ids
    const injuryMap = new Map<number, InjuryUpdate>();
    for (const inj of injuries) {
      injuryMap.set(inj.player_id, inj);
    }

    // 4. Match users whose roster contains an injured player
    const pushMessages: {
      to: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
    }[] = [];

    for (const user of userData as {
      user_id: string;
      expo_push_token: string;
      roster: { player_id: number; name: string; position: string }[];
    }[]) {
      if (!user.roster || !Array.isArray(user.roster)) continue;

      for (const rosterPlayer of user.roster) {
        const injury = injuryMap.get(rosterPlayer.player_id);
        if (injury) {
          pushMessages.push({
            to: user.expo_push_token,
            title: "Injury Alert",
            body: `${injury.player_name} ${injury.status} — ${injury.suggestion}`,
            data: {
              type: "injury_alert",
              player_id: injury.player_id,
              status: injury.status,
            },
          });
        }
      }
    }

    // 5. Send via Expo Push API
    let sent = 0;
    if (pushMessages.length > 0) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(pushMessages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[injury-alert] Expo Push API error:", errorText);
      } else {
        sent = pushMessages.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, eligible: eligibleUsers.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[injury-alert] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
