import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const getClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const validateSetup = (setup: any) => {
  if (!setup?.flagPos || !setup?.assignments) return { ok: false, error: "invalid_payload" };
  const { flagPos, assignments } = setup;

  if (!Number.isInteger(flagPos.row) || !Number.isInteger(flagPos.col)) {
    return { ok: false, error: "flag_invalid" };
  }

  const counts: Record<"a" | "b" | "c" | "d", number> = { a: 0, b: 0, c: 0, d: 0 };
  const keys = Object.keys(assignments);
  if (keys.length !== 13) return { ok: false, error: "needs_13_assignments" };

  for (const [key, type] of Object.entries(assignments)) {
    const normalized = String(type);
    if (!["a", "b", "c", "d"].includes(normalized)) {
      return { ok: false, error: "invalid_piece" };
    }
    counts[normalized as "a" | "b" | "c" | "d"] += 1;
    const [r, c] = key.split("-").map(Number);
    if (!Number.isInteger(r) || !Number.isInteger(c)) {
      return { ok: false, error: "invalid_cell" };
    }
  }

  if (counts.a !== 4 || counts.b !== 4 || counts.c !== 4 || counts.d !== 1) {
    return { ok: false, error: "wrong_counts" };
  }

  return { ok: true };
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getClient();
  const { lobbyId, userId, setup } = await req.json();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("lobby_id", lobbyId)
    .single();

  if (gameError || !game) return json({ error: "game_not_found" }, 404);

  const { data: membersData } = await supabase
    .from("lobby_members")
    .select("user_id")
    .eq("lobby_id", lobbyId);

  const members = (membersData || []) as Array<{ user_id: string }>;
  if (!members.some((m) => m.user_id === userId)) return json({ error: "not_in_lobby" }, 403);

  const validation = validateSetup(setup);
  if (!validation.ok) return json({ error: validation.error }, 400);

  const state = (game.state_json ?? {}) as Record<string, any>;
  const setups = { ...(state.setups ?? {}) } as Record<string, any>;
  const setupConfirmed = { ...(state.setupConfirmed ?? {}) } as Record<string, boolean>;
  setups[userId] = setup;
  setupConfirmed[userId] = true;

  const nextState = { ...state, setups, setupConfirmed } as Record<string, any>;
  const allReady = members.length === 2 && members.every((m) => setupConfirmed[m.user_id]);

  const now = new Date();
  const turnEndsAt = new Date(now.getTime() + 30000).toISOString();
  const updates: Record<string, any> = {
    state_json: nextState,
    updated_at: now.toISOString(),
  };

  if (allReady) {
    const currentPlayerUserId = game.player1_id ?? members[0]?.user_id ?? null;
    const nextPlayerUserId =
      currentPlayerUserId === game.player1_id ? game.player2_id : game.player1_id;
    updates.status = "playing";
    updates.turn_index = 1;
    updates.turn_ends_at = turnEndsAt;
    updates.setup_ends_at = null;
    updates.current_turn = currentPlayerUserId;
    updates.state_json = {
      ...nextState,
      setupPhase: false,
      currentPlayerUserId,
      nextPlayerUserId,
      turnIndex: 1,
      turnEndsAt: turnEndsAt,
      p1Penalties: nextState.p1Penalties ?? 0,
      p2Penalties: nextState.p2Penalties ?? 0,
      winner: null,
      gameOver: false,
    };
    await supabase
      .from("lobbies")
      .update({ status: "playing", setup_ends_at: null })
      .eq("id", lobbyId);
  }

  await supabase.from("games").update(updates).eq("id", game.id);

  return json({ ok: true, allReady });
};
