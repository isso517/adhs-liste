import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, ArrowLeft } from 'lucide-react';

// Sub-components for specific games
import { TicTacToeGame } from '../components/games/TicTacToeGame';
import { RPSGame } from '../components/games/RPSGame';
import { ChessGame } from '../components/games/ChessGame';
import { FreestyleChessGame } from '../components/games/FreestyleChessGame';

export const GameBoardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    
    fetchGame();

    const channel = supabase
      .channel(`game:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setGame(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const fetchGame = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGame(data);
    } catch (err) {
      console.error(err);
      alert('Spiel nicht gefunden.');
      navigate('/games');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;
  if (!game) return null;

  const isPlayer1 = user?.id === game.player1_id;
  const isMyTurn = game.current_turn === user?.id;

  const handleUpdateGameState = async (newState: any, nextTurnId?: string, winnerId?: string) => {
    const updates: any = {
      state: newState,
      updated_at: new Date().toISOString()
    };

    if (nextTurnId !== undefined) updates.current_turn = nextTurnId;
    if (winnerId !== undefined) {
      updates.winner_id = winnerId;
      updates.status = 'finished';
    }

    await supabase.from('games').update(updates).eq('id', id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/games')}
          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white drop-shadow-md uppercase tracking-wider">
            {game.game_type === 'tictactoe' && 'Tic-Tac-Toe'}
            {game.game_type === 'chess' && 'Schach'}
            {game.game_type === 'rps' && 'Schere Stein Papier'}
            {game.game_type === 'freestyle_chess' && 'Freestyle Chess'}
          </h2>
          <p className="text-xs text-white/80">
            {game.status === 'finished' 
              ? (game.winner_id ? (game.winner_id === user?.id ? 'Du hast gewonnen!' : 'Verloren!') : 'Unentschieden!') 
              : (isMyTurn ? 'Du bist dran!' : 'Gegner ist dran...')}
          </p>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden flex items-center justify-center p-4">
        {game.game_type === 'tictactoe' && (
          <TicTacToeGame 
            gameState={game.state} 
            isMyTurn={isMyTurn} 
            onMove={(newState, winner) => {
              // Switch turn
              const nextTurn = isPlayer1 ? game.player2_id : game.player1_id;
              handleUpdateGameState(newState, winner ? undefined : nextTurn, winner);
            }}
            myPlayerId={user!.id}
          />
        )}
        
        {/* Placeholders for other games */}
        {game.game_type === 'chess' && (
             <ChessGame 
             gameState={game.state} 
             isMyTurn={isMyTurn}
             isPlayer1={isPlayer1} // Player 1 is usually White
             onMove={(newState, nextTurnId, winnerId) => {
               handleUpdateGameState(newState, nextTurnId, winnerId);
             }}
             player1Id={game.player1_id}
             player2Id={game.player2_id}
           />
        )}

        {game.game_type === 'rps' && (
           <RPSGame 
           gameState={game.state} 
           isMyTurn={true} // RPS is simultaneous mostly, or state based
           myPlayerId={user!.id}
           onMove={(newState, winnerId) => {
             // For RPS, we don't switch turns immediately, we wait for both. 
             // Logic will be inside RPSGame component.
             handleUpdateGameState(newState, undefined, winnerId);
           }}
         />
        )}

        {game.game_type === 'freestyle_chess' && (
           <FreestyleChessGame 
           gameState={game.state} 
           isMyTurn={isMyTurn}
           isPlayer1={isPlayer1}
           onMove={(newState: any, nextTurnId: string, winnerId?: string) => {
             handleUpdateGameState(newState, nextTurnId, winnerId);
           }}
           player1Id={game.player1_id}
           player2Id={game.player2_id}
           myPlayerId={user!.id}
         />
        )}
      </div>
    </div>
  );
};
