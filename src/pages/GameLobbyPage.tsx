import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, ArrowLeft } from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  avatar_url?: string;
}

export const GameLobbyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const gameType = searchParams.get('type') || 'tictactoe';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchFriends();
  }, [user]);

  const fetchFriends = async () => {
    try {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = friendships.map(f => f.user_id === user!.id ? f.friend_id : f.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds);

      if (profilesError) throw profilesError;
      setFriends(profiles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async (friendId: string) => {
    setInviteLoading(friendId);
    try {
      const { error } = await supabase
        .from('game_invites')
        .insert({
          sender_id: user!.id,
          receiver_id: friendId,
          game_type: gameType
        });

      if (error) throw error;
      alert('Einladung gesendet!');
      navigate('/games'); // Back to hub to wait
    } catch (err) {
      console.error(err);
      alert('Fehler beim Senden.');
    } finally {
      setInviteLoading(null);
    }
  };

  const getGameName = () => {
    switch(gameType) {
      case 'chess': return 'Schach';
      case 'tictactoe': return 'Tic-Tac-Toe';
      case 'rps': return 'Schere Stein Papier';
      default: return 'Spiel';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/games')}
          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
          {getGameName()} - Gegner wählen
        </h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : friends.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            Du hast noch keine Freunde. Füge erst jemanden im Social Hub hinzu!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {friends.map(friend => (
              <div key={friend.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase overflow-hidden">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      friend.username.substring(0, 2)
                    )}
                  </div>
                  <span className="font-medium text-gray-900">{friend.username}</span>
                </div>
                <button
                  onClick={() => sendInvite(friend.id)}
                  disabled={inviteLoading === friend.id}
                  className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {inviteLoading === friend.id ? <Loader2 className="animate-spin" size={16} /> : 'Einladen'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
