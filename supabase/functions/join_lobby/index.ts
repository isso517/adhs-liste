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

const resolveTeam = (members: Array<{ user_id: string; team?: number | null }>) => {
  const used = new Set(members.map((m) => m.team).filter((v) => v === 1 || v === 2));
  if (!used.has(1)) return 1;
  if (!used.has(2)) return 2;
  return members.length === 0 ? 1 : 2;
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getClient();
  const { lobbyId, userId } = await req.json();

  const { data: lobby, error: lobbyError } = await supabase
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  if (lobbyError || !lobby) return json({ error: "lobby_not_found" }, 404);

  const { data: membersData } = await supabase
    .from("lobby_members")
    .select("user_id, team")
    .eq("lobby_id", lobbyId);

  const members = (membersData || []) as Array<{ user_id: string; team?: number | null }>;
  const existing = members.find((m) => m.user_id === userId);
  const isMember = Boolean(existing);
  const count = members.length;

  if (!isMember && count >= 2) return json({ error: "lobby_full" }, 409);

  if (!isMember) {
    const team = resolveTeam(members);
    const { error: joinError } = await supabase
      .from("lobby_members")
      .insert({ lobby_id: lobbyId, user_id: userId, team });
    if (joinError) return json({ error: "join_failed" }, 400);
  }

  const { data: updatedMembersData } = await supabase
    .from("lobby_members")
    .select("user_id, team")
    .eq("lobby_id", lobbyId);

  const updatedMembers = (updatedMembersData || []) as Array<{ user_id: string; team?: number | null }>;
  if (updatedMembers.length === 2) {
    const setupEndsAt = new Date(Date.now() + 120000).toISOString();
    await supabase
      .from("lobbies")
      .update({ status: "setup", setup_ends_at: setupEndsAt })
      .eq("id", lobbyId);

    const { data: game } = await supabase
      .from("games")
      .select("id, player1_id, player2_id, state_json")
      .eq("lobby_id", lobbyId)
      .maybeSingle();

    const memberA = updatedMembers[0];
    const memberB = updatedMembers[1];
    const player1 = memberA?.team === 2 ? memberB?.user_id : memberA?.user_id;
    const player2 = memberA?.team === 2 ? memberA?.user_id : memberB?.user_id;
    const baseState = {
      setupPhase: true,
      currentPlayerUserId: player1,
      nextPlayerUserId: player2,
      turnIndex: 0,
      p1Penalties: 0,
      p2Penalties: 0,
      setups: {},
      setupConfirmed: {},
    };

    if (!game) {
      await supabase.from("games").insert({
        lobby_id: lobbyId,
        player1_id: player1,
        player2_id: player2,
        current_turn: player1,
        status: "setup",
        state_json: baseState,
        turn_index: 0,
        setup_ends_at: setupEndsAt,
      });
    } else {
      const nextState = { ...(game.state_json ?? {}), ...baseState };
      await supabase
        .from("games")
        .update({
          player1_id: game.player1_id ?? player1,
          player2_id: game.player2_id ?? player2,
          current_turn: game.current_turn ?? player1,
          status: "setup",
          state_json: nextState,
          setup_ends_at: setupEndsAt,
        })
        .eq("id", game.id);
    }
  }

  const finalMembers = updatedMembers.length ? updatedMembers : members;
  const team = finalMembers.find((m) => m.user_id === userId)?.team ?? existing?.team ?? null;
  return json({ ok: true, team });
};
