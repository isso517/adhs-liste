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

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getClient();

  const now = new Date();
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("status", "playing")
    .lt("turn_ends_at", now.toISOString());

  const updated = [];

  for (const game of games || []) {
    const state = (game.state_json ?? {}) as Record<string, any>;
    const currentPlayer = state.currentPlayerUserId;
    const nextPlayer = state.nextPlayerUserId;
    const p1 = (game.p1_penalties ?? 0) + (currentPlayer === game.player1_id ? 1 : 0);
    const p2 = (game.p2_penalties ?? 0) + (currentPlayer === game.player2_id ? 1 : 0);
    const winner =
      p1 >= 2 ? game.player2_id : p2 >= 2 ? game.player1_id : null;

    const turnEndsAt = new Date(now.getTime() + 30000).toISOString();

    await supabase
      .from("games")
      .update({
        p1_penalties: p1,
        p2_penalties: p2,
        current_turn: winner ? null : nextPlayer ?? (currentPlayer === game.player1_id ? game.player2_id : game.player1_id),
        state_json: {
          ...state,
          currentPlayerUserId: nextPlayer ?? (currentPlayer === game.player1_id ? game.player2_id : game.player1_id),
          nextPlayerUserId: currentPlayer,
          turnIndex: (state.turnIndex ?? game.turn_index ?? 0) + 1,
          turnEndsAt: winner ? null : turnEndsAt,
          p1Penalties: p1,
          p2Penalties: p2,
        },
        turn_index: (game.turn_index ?? 0) + 1,
        turn_ends_at: winner ? null : turnEndsAt,
        winner,
        status: winner ? "finished" : game.status,
        updated_at: now.toISOString(),
      })
      .eq("id", game.id);

    updated.push(game.id);
  }

  return json({ ok: true, updated });
};
