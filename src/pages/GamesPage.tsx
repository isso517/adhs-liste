import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Sword, Brain, Hand, Crown } from 'lucide-react';

interface Invite {
  id: string;
  sender_id: string;
  game_type: 'chess' | 'tictactoe' | 'rps' | 'freestyle_chess';
  status: 'pending' | 'accepted' | 'declined';
  sender?: { username: string; avatar_url: string };
}

export const GamesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invites, setInvites] = useState<Invite[]>([]);

  // Listen for invites
  useEffect(() => {
    if (!user) return;

    fetchInvites();

    const channel = supabase
      .channel('public:game_invites')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_invites',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          // New invite received
          fetchInvites();
          // Ideally show a toast here
          alert('Neue Spieleinladung erhalten!');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_invites',
          filter: `sender_id=eq.${user.id}`
        },
        (payload) => {
          // My invite was accepted/declined
          const newInvite = payload.new as any;
          if (newInvite.status === 'accepted' && newInvite.game_id) {
            navigate(`/game/${newInvite.game_id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('game_invites')
        .select(`
          *,
          sender:profiles!sender_id(username, avatar_url)
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
    }
  };

  const handleAcceptInvite = async (invite: Invite) => {
    try {
      // 1. Create Game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          game_type: invite.game_type,
          player1_id: invite.sender_id,
          player2_id: user!.id,
          status: 'playing',
          current_turn: invite.game_type === 'rps' ? null : invite.sender_id // Sender starts usually
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // 2. Update Invite
      const { error: inviteError } = await supabase
        .from('game_invites')
        .update({ status: 'accepted', game_id: game.id })
        .eq('id', invite.id);

      if (inviteError) throw inviteError;

      // 3. Navigate
      navigate(`/game/${game.id}`);
    } catch (err) {
      console.error('Error accepting invite:', err);
      alert('Fehler beim Annehmen.');
    }
  };

  const handleDeclineInvite = async (id: string) => {
    await supabase.from('game_invites').update({ status: 'declined' }).eq('id', id);
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const startNewGame = (type: 'chess' | 'tictactoe' | 'rps' | 'freestyle_chess') => {
    // Navigate to a lobby/select friend screen
    navigate(`/games/new?type=${type}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center justify-center gap-4 relative">
        <h2 className="text-2xl font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] text-center w-full">Spiele</h2>
      </div>

      {/* Invites Section */}
      {invites.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
            <Users size={18} />
            Offene Einladungen
          </h3>
          {invites.map(invite => (
            <div key={invite.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {invite.sender?.avatar_url ? (
                    <img src={invite.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                      {invite.sender?.username.substring(0, 2)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{invite.sender?.username}</div>
                  <div className="text-xs text-gray-500">möchte {invite.game_type} spielen</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAcceptInvite(invite)} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600">Annehmen</button>
                <button onClick={() => handleDeclineInvite(invite.id)} className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">X</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game Selection */}
      <div className="grid grid-cols-1 gap-4">
        {/* Freestyle Chess */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
              <Crown size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-gray-800">Freestyle Chess</h3>
              <p className="text-sm text-gray-500">Strategie mit verdeckten Rollen.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('freestyle_chess', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('freestyle_chess', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Brain size={16} /> vs CPU
             </button>
           </div>
        </div>

        {/* Chess */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Brain size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-gray-800">Schach</h3>
              <p className="text-sm text-gray-500">Der Klassiker. Strategie pur.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('chess', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('chess', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Brain size={16} /> vs CPU
             </button>
           </div>
        </div>

        {/* Tic Tac Toe */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <Sword size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-gray-800">Tic-Tac-Toe</h3>
              <p className="text-sm text-gray-500">Schnell und spaßig.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('tictactoe', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('tictactoe', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Monitor size={16} /> vs CPU
             </button>
           </div>
        </div>

        {/* RPS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <Hand size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-gray-800">Schere Stein Papier</h3>
              <p className="text-sm text-gray-500">Entscheide es wie Männer.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('rps', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('rps', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Monitor size={16} /> vs CPU
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
