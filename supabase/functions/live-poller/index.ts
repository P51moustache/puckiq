// live-poller: scratch and goal pushes on NHL game nights. pg_cron calls it every minute
// (supabase/cron/live-poller.sql) with the service-role key. Deploy WITH JWT verification (the
// default); the handler also requires the service_role claim, so the public anon key cannot run it.
//
// One run: NHL game day -> /v1/score/{day} -> stop unless a game is live, starts within 90 minutes or
// just ended -> per game, read right-rail (scratches) and play-by-play (goals) only as planned ->
// diff against live_game_state -> match alert_devices -> claim alert_log rows -> Expo push.
// All decisions live in ../_shared/alerts.ts (pure, jest-tested); this file only does I/O.
// Old alert_log / live_game_state rows are purged by the daily cleanup job in the same cron file.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AlertDevice,
  type ExpoMessage,
  type GameMemory,
  type GamePlan,
  type PendingAlert,
  EXPO_BATCH_SIZE,
  EXPO_PUSH_URL,
  NHL_WEB_API,
  bearerRole,
  buildAlerts,
  chunk,
  deviceFromRow,
  evaluateGame,
  eventPlayerIds,
  isCandidate,
  mapLimit,
  memoryFromRow,
  memoryToRow,
  nhlGameDay,
  parsePlayByPlay,
  parseScoreGames,
  parseScratches,
  planGame,
  readExpoTickets,
} from "../_shared/alerts.ts";

/** Service-role client: the alert tables have no client policies. */
function connect() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type Db = ReturnType<typeof connect>;

/** Gentle on the NHL: at most 4 requests in flight, each abandoned after 8 seconds. */
const NHL_CONCURRENCY = 4;
const NHL_TIMEOUT_MS = 8_000;
const EXPO_TIMEOUT_MS = 15_000;
/** PostgREST returns at most 1000 rows per request by default. */
const PAGE_SIZE = 1000;
/** Rows per alert_log claim insert (keeps request bodies small). */
const CLAIM_BATCH = 500;
const USER_AGENT = "PuckIQ live-poller (+https://p51moustache.github.io/puckiq/)";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fetchJson(url: string, timeoutMs: number, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const nhl = (path: string) =>
  fetchJson(`${NHL_WEB_API}${path}`, NHL_TIMEOUT_MS, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

/** A failed read skips that part of the game this minute (null); the next run tries again. */
async function tryRead<T>(label: string, read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.warn(`[live-poller] ${label} failed: ${String(error)}`);
    return null;
  }
}

async function loadMemories(db: Db, gameIds: number[]): Promise<Map<number, GameMemory>> {
  const { data, error } = await db
    .from("live_game_state")
    .select("game_id, game_date, game_state, scratch_ids, goal_event_ids")
    .in("game_id", gameIds);
  if (error) throw new Error(`live_game_state read: ${error.message}`);
  const memories = new Map<number, GameMemory>();
  for (const row of data ?? []) {
    const memory = memoryFromRow(row);
    if (memory) memories.set(memory.gameId, memory);
  }
  return memories;
}

/** Devices following any of these players (GIN-indexed && on player_ids), all pages. */
async function loadDevices(db: Db, playerIds: number[]): Promise<AlertDevice[]> {
  const devices: AlertDevice[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("alert_devices")
      .select("expo_push_token, player_ids, prefs")
      .overlaps("player_ids", playerIds)
      .order("expo_push_token")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`alert_devices read: ${error.message}`);
    for (const row of data ?? []) {
      const device = deviceFromRow(row);
      if (device) devices.push(device);
    }
    if (!data || data.length < PAGE_SIZE) return devices;
  }
}

/**
 * Inserts alert_log rows before sending (ON CONFLICT DO NOTHING) and keeps only the alerts this run
 * won, so overlapping runs never push twice. A game whose claim fails is reported so its state is
 * not saved and the next minute retries it.
 */
async function claimAlerts(db: Db, alerts: PendingAlert[]): Promise<{ claimed: PendingAlert[]; failedGames: Set<number> }> {
  const claimed: PendingAlert[] = [];
  const failedGames = new Set<number>();
  const byKey = new Map(alerts.map((alert) => [`${alert.token}\n${alert.eventKey}`, alert]));
  for (const batch of chunk(alerts, CLAIM_BATCH)) {
    const rows = batch.map((alert) => ({ expo_push_token: alert.token, event_key: alert.eventKey }));
    const { data, error } = await db
      .from("alert_log")
      .upsert(rows, { onConflict: "expo_push_token,event_key", ignoreDuplicates: true })
      .select("expo_push_token, event_key");
    if (error) {
      console.error(`[live-poller] alert_log claim failed: ${error.message}`);
      batch.forEach((alert) => failedGames.add(alert.gameId));
      continue;
    }
    for (const row of (data ?? []) as { expo_push_token: string; event_key: string }[]) {
      const alert = byKey.get(`${row.expo_push_token}\n${row.event_key}`);
      if (alert) claimed.push(alert);
    }
  }
  return { claimed, failedGames };
}

/** Sends in Expo-sized batches, one request at a time. */
async function sendPushes(messages: ExpoMessage[]): Promise<{ sent: number; failed: number; deadTokens: string[] }> {
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    try {
      const response = await fetchJson(EXPO_PUSH_URL, EXPO_TIMEOUT_MS, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      const tickets = readExpoTickets(batch, response);
      sent += tickets.ok;
      failed += tickets.failed;
      deadTokens.push(...tickets.deadTokens);
    } catch (error) {
      console.error(`[live-poller] Expo push failed: ${String(error)}`);
      failed += batch.length;
    }
  }
  return { sent, failed, deadTokens };
}

async function poll(now: Date) {
  const nowMs = now.getTime();
  const gameDay = nhlGameDay(now);
  const games = parseScoreGames(await nhl(`/v1/score/${gameDay}`));
  const candidates = games.filter((game) => isCandidate(game, nowMs));
  if (candidates.length === 0) return { ok: true, gameDay, games: games.length, active: 0 };

  const db = connect();
  const memories = await loadMemories(db, candidates.map((game) => game.gameId));
  const plans = candidates
    .map((game) => planGame(game, memories.get(game.gameId), nowMs))
    .filter((plan): plan is GamePlan => plan !== null);

  const results = await mapLimit(plans, NHL_CONCURRENCY, async (plan) => {
    const id = plan.game.gameId;
    const scratches = plan.readScratches
      ? await tryRead(`right-rail ${id}`, async () => parseScratches(await nhl(`/v1/gamecenter/${id}/right-rail`)))
      : undefined;
    const playByPlay = plan.readGoals
      ? await tryRead(`play-by-play ${id}`, async () => parsePlayByPlay(await nhl(`/v1/gamecenter/${id}/play-by-play`)))
      : undefined;
    return { gameId: id, ...evaluateGame(plan, gameDay, scratches, playByPlay) };
  });

  const events = results.flatMap((result) => result.events);
  let pushes = { sent: 0, failed: 0, deadTokens: [] as string[] };
  let failedGames = new Set<number>();
  if (events.length > 0) {
    const devices = await loadDevices(db, eventPlayerIds(events));
    const claim = await claimAlerts(db, buildAlerts(events, devices));
    failedGames = claim.failedGames;
    pushes = await sendPushes(claim.claimed.map((alert) => alert.message));
    if (pushes.deadTokens.length > 0) {
      const { error } = await db.from("alert_devices").delete().in("expo_push_token", pushes.deadTokens);
      if (error) console.warn(`[live-poller] dead token cleanup: ${error.message}`);
    }
  }

  const nowIso = now.toISOString();
  const rows = results
    .filter((result) => result.memory !== null && !failedGames.has(result.gameId))
    .map((result) => memoryToRow(result.memory as GameMemory, nowIso));
  if (rows.length > 0) {
    const { error } = await db.from("live_game_state").upsert(rows, { onConflict: "game_id" });
    if (error) throw new Error(`live_game_state write: ${error.message}`);
  }

  return {
    ok: true,
    gameDay,
    games: games.length,
    active: plans.length,
    events: events.length,
    sent: pushes.sent,
    failed: pushes.failed,
    removedTokens: pushes.deadTokens.length,
  };
}

Deno.serve(async (req: Request) => {
  if (bearerRole(req.headers.get("Authorization")) !== "service_role") {
    return json({ error: "forbidden" }, 403);
  }
  try {
    return json(await poll(new Date()));
  } catch (error) {
    console.error(`[live-poller] run failed: ${String(error)}`);
    return json({ error: "poll_failed" }, 500);
  }
});
