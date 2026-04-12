import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ConfirmedGoalie {
  player_id: number;
  player_name: string;
  team_abbrev: string;
  opponent_abbrev: string;
}

serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Accept confirmed goalies from request body (sent by sync pipeline)
    let confirmedGoalies: ConfirmedGoalie[] = [];
    try {
      const body = await req.json();
      confirmedGoalies = body.goalies ?? [];
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must contain { goalies: [...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (confirmedGoalies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No confirmed goalies provided" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Find all users with goalieConfirmed enabled
    const { data: prefRows, error: prefError } = await supabaseClient
      .from("notification_preferences")
      .select("user_id, fantasy_prefs")
      .not("fantasy_prefs", "is", null);

    if (prefError) {
      console.error("[goalie-confirmed] Error loading preferences:", prefError.message);
      return new Response(JSON.stringify({ error: prefError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eligibleUsers = (prefRows ?? []).filter(
      (row: { user_id: string; fantasy_prefs: Record<string, boolean> }) =>
        row.fantasy_prefs?.goalieConfirmed === true
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
      console.error("[goalie-confirmed] Error loading user data:", userError.message);
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

    // 3. Build a map of confirmed goalie player_ids
    const goalieMap = new Map<number, ConfirmedGoalie>();
    for (const g of confirmedGoalies) {
      goalieMap.set(g.player_id, g);
    }

    // 4. Match users whose roster contains a confirmed starter
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
        const confirmed = goalieMap.get(rosterPlayer.player_id);
        if (confirmed) {
          pushMessages.push({
            to: user.expo_push_token,
            title: "Goalie Confirmed",
            body: `${confirmed.player_name} confirmed starting vs ${confirmed.opponent_abbrev}. Start with confidence.`,
            data: {
              type: "goalie_confirmed",
              player_id: confirmed.player_id,
              team: confirmed.team_abbrev,
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
        console.error("[goalie-confirmed] Expo Push API error:", errorText);
      } else {
        sent = pushMessages.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, eligible: eligibleUsers.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[goalie-confirmed] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
