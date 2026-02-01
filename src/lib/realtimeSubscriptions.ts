import { supabase } from "./supabase";

export const subscribeToLobbies = (onChange: () => void) => {
  const channel = supabase
    .channel("lobbies")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lobbies" },
      () => onChange(),
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export const subscribeToGameState = (lobbyId: string, onSnapshot: (game: any) => void) => {
  const channel = supabase
    .channel(`games:${lobbyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `lobby_id=eq.${lobbyId}` },
      (payload) => onSnapshot(payload.new),
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export const subscribeToMoves = (gameId: string, onMove: (move: any) => void) => {
  const channel = supabase
    .channel(`moves:${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "moves", filter: `game_id=eq.${gameId}` },
      (payload) => onMove(payload.new),
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
