import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface UserData {
  user_id: string;
  expo_push_token: string;
  roster: { player_id: number; name: string; position: string }[];
}

interface PlayerProjection {
  player_id: number;
  player_name: string;
  recommendation: string; // "START" | "SIT" | "BENCH"
  reason: string;
  has_game_today: boolean;
}

serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find all users with morningBrief enabled
    const { data: prefRows, error: prefError } = await supabaseClient
      .from("notification_preferences")
      .select("user_id, fantasy_prefs")
      .not("fantasy_prefs", "is", null);

    if (prefError) {
      console.error("[morning-brief] Error loading preferences:", prefError.message);
      return new Response(JSON.stringify({ error: prefError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eligibleUsers = (prefRows ?? []).filter(
      (row: { user_id: string; fantasy_prefs: Record<string, boolean> }) =>
        row.fantasy_prefs?.morningBrief === true
    );

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No eligible users" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Get push tokens for eligible users
    const userIds = eligibleUsers.map((u: { user_id: string }) => u.user_id);
    const { data: userData, error: userError } = await supabaseClient
      .from("user_data")
      .select("user_id, expo_push_token, roster")
      .in("user_id", userIds)
      .not("expo_push_token", "is", null);

    if (userError) {
      console.error("[morning-brief] Error loading user data:", userError.message);
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userData || userData.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No users with push tokens" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Get today's date in ET
    const now = new Date();
    const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = etDate.toISOString().split("T")[0];

    // 4. Fetch today's player projections
    const { data: projections, error: projError } = await supabaseClient
      .from("ml_player_projections")
      .select("player_id, player_name, recommendation, reason, has_game_today")
      .eq("game_date", today);

    if (projError) {
      console.error("[morning-brief] Error loading projections:", projError.message);
    }

    const projectionsMap = new Map<number, PlayerProjection>();
    for (const p of projections ?? []) {
      projectionsMap.set(p.player_id, p);
    }

    // 5. Build and send notifications for each user
    const pushMessages: {
      to: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
    }[] = [];

    for (const user of userData as UserData[]) {
      if (!user.roster || !Array.isArray(user.roster)) continue;

      const rosterPlayerIds = user.roster.map((p) => p.player_id);
      const activeTonight: PlayerProjection[] = [];
      const sitRecommendations: PlayerProjection[] = [];

      for (const pid of rosterPlayerIds) {
        const proj = projectionsMap.get(pid);
        if (proj?.has_game_today) {
          activeTonight.push(proj);
          if (proj.recommendation === "SIT") {
            sitRecommendations.push(proj);
          }
        }
      }

      if (activeTonight.length === 0) continue;

      let body = `${activeTonight.length} player${activeTonight.length === 1 ? "" : "s"} active tonight.`;
      if (sitRecommendations.length > 0) {
        const sit = sitRecommendations[0];
        body += ` ${sit.player_name} is a sit — ${sit.reason}.`;
      }

      pushMessages.push({
        to: user.expo_push_token,
        title: "Morning Lineup Brief",
        body,
        data: { type: "morning_brief", date: today },
      });
    }

    // 6. Send via Expo Push API (batch)
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
        console.error("[morning-brief] Expo Push API error:", errorText);
      } else {
        sent = pushMessages.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, eligible: eligibleUsers.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[morning-brief] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
