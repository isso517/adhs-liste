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

const parsePosition = (value: unknown) => {
  if (Array.isArray(value) && value.length === 2) {
    const [row, col] = value;
    if (Number.isInteger(row) && Number.isInteger(col)) return [row, col] as [number, number];
  }
  if (typeof value === "string") {
    const parts = value.split(",").map((v) => Number(v.trim()));
    if (parts.length === 2 && parts.every((v) => Number.isInteger(v))) {
      return [parts[0], parts[1]] as [number, number];
    }
  }
  return null;
};

const applyMove = (state: Record<string, any>, from: [number, number], to: [number, number]) => {
  const moves = Array.isArray(state.moves) ? state.moves : [];
  return { ...state, moves: [...moves, { from, to, at: Date.now() }] } as Record<string, any>;
};

const resolveDuel = () => {
  const choices = ["a", "b", "c"];
  const attackerChoice = choices[Math.floor(Math.random() * 3)];
  let defenderChoice = choices[Math.floor(Math.random() * 3)];
  while (defenderChoice === attackerChoice) {
    defenderChoice = choices[Math.floor(Math.random() * 3)];
  }
  return { attackerChoice, defenderChoice };
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getClient();
  const { lobbyId, from, to, turnIndex, userId, duel } = await req.json();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("lobby_id", lobbyId)
    .single();

  if (!game) return json({ error: "game_not_found" }, 404);

  const state = (game.state_json ?? {}) as Record<string, any>;
  if (game.turn_index !== turnIndex) return json({ error: "stale_turn" }, 409);
  if (state.currentPlayerUserId !== userId) return json({ error: "not_your_turn" }, 403);

  const fromPos = parsePosition(from);
  const toPos = parsePosition(to);
  if (!fromPos || !toPos) return json({ error: "invalid_move" }, 400);
  if (fromPos[0] === toPos[0] && fromPos[1] === toPos[1]) {
    return json({ error: "invalid_move" }, 400);
  }

  const currentPlayerUserId = state.currentPlayerUserId;
  const nextPlayerUserId =
    state.nextPlayerUserId ??
    (currentPlayerUserId === game.player1_id ? game.player2_id : game.player1_id);

  let next = applyMove(state, fromPos, toPos) as Record<string, any>;
  if (duel === true) {
    const duelResult = resolveDuel();
    const moves = Array.isArray(next.moves) ? next.moves : [];
    const last = moves[moves.length - 1];
    if (last) {
      moves[moves.length - 1] = { ...last, duelResult };
      next = { ...next, moves };
    }
  }
  const now = new Date();
  const nextTurnEnds = new Date(now.getTime() + 30000).toISOString();

  await supabase
    .from("games")
    .update({
      state_json: {
        ...next,
        currentPlayerUserId: nextPlayerUserId,
        nextPlayerUserId: currentPlayerUserId,
        turnIndex: (state.turnIndex ?? game.turn_index ?? 0) + 1,
        turnEndsAt: nextTurnEnds,
      },
      turn_index: game.turn_index + 1,
      turn_ends_at: nextTurnEnds,
      current_turn: nextPlayerUserId,
      p1_penalties: next.p1Penalties ?? game.p1_penalties ?? 0,
      p2_penalties: next.p2Penalties ?? game.p2_penalties ?? 0,
      winner: next.winner ?? null,
      updated_at: now.toISOString(),
    })
    .eq("id", game.id);

  return json({ ok: true });
};
