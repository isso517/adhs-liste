import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Users, Sword, Brain, Hand, X } from 'lucide-react';
import { clsx } from 'clsx';
import samuraiHtmlRaw from '../components/games/SumaraiGame/index.html?raw';
import samuraiCssRaw from '../components/games/SumaraiGame/style.css?raw';
import samuraiJsRaw from '../components/games/SumaraiGame/script.js?raw';

interface Invite {
  id: string;
  sender_id: string;
  game_type: 'tictactoe' | 'rps';
  status: 'pending' | 'accepted' | 'declined';
  sender?: { username: string; avatar_url: string };
}

export const GamesPage: React.FC = () => {
  const { user } = useAuth();
  const { themes, activeThemeId } = useApp();
  const navigate = useNavigate();
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];

  const [invites, setInvites] = useState<Invite[]>([]);
  const [showSamurai, setShowSamurai] = useState(false);

  useEffect(() => {
    (window as any).__supabaseClient = supabase;
    return () => {
      if ((window as any).__supabaseClient === supabase) {
        delete (window as any).__supabaseClient;
      }
    };
  }, []);

  const samuraiSrcDoc = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
    const backgroundUrl = new URL('../components/games/SumaraiGame/Background.png', import.meta.url).href;
    const figurUrl = new URL('../components/games/SumaraiGame/Figur.png', import.meta.url).href;
    const schereUrl = new URL('../components/games/SumaraiGame/Schere.png', import.meta.url).href;
    const steinUrl = new URL('../components/games/SumaraiGame/Stein.png', import.meta.url).href;
    const blattUrl = new URL('../components/games/SumaraiGame/Blatt.png', import.meta.url).href;
    const schwertUrl = new URL('../components/games/SumaraiGame/Schwert.png', import.meta.url).href;
    const fahneUrl = new URL('../components/games/SumaraiGame/Fahne.png', import.meta.url).href;
    const videoSchereUrl = new URL('../components/games/SumaraiGame/Video Schere.mp4', import.meta.url).href;
    const videoSteinUrl = new URL('../components/games/SumaraiGame/Video Stein.mp4', import.meta.url).href;
    const videoBlattUrl = new URL('../components/games/SumaraiGame/Video Blatt.mp4', import.meta.url).href;

    const css = samuraiCssRaw
      .replaceAll('Background.png', backgroundUrl)
      .replaceAll('Figur.png', figurUrl)
      .replaceAll('Schere.png', schereUrl)
      .replaceAll('Stein.png', steinUrl)
      .replaceAll('Blatt.png', blattUrl)
      .replaceAll('Schwert.png', schwertUrl)
      .replaceAll('Fahne.png', fahneUrl);

    const js = samuraiJsRaw
      .replaceAll('Video Schere.mp4', videoSchereUrl)
      .replaceAll('Video Stein.mp4', videoSteinUrl)
      .replaceAll('Video Blatt.mp4', videoBlattUrl);

    const bodyMatch = samuraiHtmlRaw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : samuraiHtmlRaw;

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>侍の戦い - Samurai Schlacht</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&family=Kosugi+Maru&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  ${bodyContent}
  <script>
    window.__supabaseClient = window.parent?.__supabaseClient || null;
    window.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
    window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
  </script>
  <script>${js}</script>
</body>
</html>`;
  }, []);

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
      const filteredInvites = (data || []).filter((invite: Invite) => invite.game_type === 'tictactoe' || invite.game_type === 'rps');
      setInvites(filteredInvites);
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

  const startNewGame = (type: 'tictactoe' | 'rps', mode: 'pvp' | 'pvc' = 'pvp') => {
    if (mode === 'pvc') {
      navigate(`/game/local?type=${type}`);
    } else {
      navigate(`/games/new?type=${type}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center justify-center gap-4 relative">
        <h2 className={clsx("text-2xl font-bold drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] text-center w-full", activeTheme.colors.text)}>Spiele</h2>
      </div>

      {/* Invites Section */}
      {invites.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
            <Users size={18} />
            Offene Einladungen
          </h3>
          {invites.map(invite => (
            <div key={invite.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between text-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {invite.sender?.avatar_url ? (
                    <img src={invite.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-900 font-bold">
                      {invite.sender?.username.substring(0, 2)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{invite.sender?.username}</div>
                  <div className="text-xs text-gray-900">möchte {invite.game_type} spielen</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAcceptInvite(invite)} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600">Annehmen</button>
                <button onClick={() => handleDeclineInvite(invite.id)} className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-xs hover:bg-gray-300">X</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game Selection */}
      <div className="grid grid-cols-1 gap-4">
        {/* Tic Tac Toe */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-gray-900">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <Sword size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold">Tic-Tac-Toe</h3>
              <p className="text-sm">Schnell und spaßig.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('tictactoe', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('tictactoe', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Brain size={16} /> vs CPU
             </button>
           </div>
        </div>

        {/* RPS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-gray-900">
           <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <Hand size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold">Schere Stein Papier</h3>
              <p className="text-sm">Entscheide es wie Männer.</p>
            </div>
           </div>
           <div className="flex border-t border-gray-100">
             <button onClick={() => startNewGame('rps', 'pvp')} className="flex-1 p-3 text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2 border-r border-gray-100">
               <Users size={16} /> vs Freund
             </button>
             <button onClick={() => startNewGame('rps', 'pvc')} className="flex-1 p-3 text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2">
               <Brain size={16} /> vs CPU
             </button>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-gray-900">
          <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-700">
              <Sword size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold">Samurai Schlacht</h3>
              <p className="text-sm">Strategisches Duell mit Lobbys.</p>
            </div>
          </div>
          <div className="flex border-t border-gray-100">
            <button onClick={() => setShowSamurai(true)} className="flex-1 p-3 text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center justify-center gap-2">
              Starten
            </button>
          </div>
        </div>
      </div>

      {showSamurai && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-5xl bg-white rounded-t-2xl shadow-2xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="font-bold text-gray-900">Samurai Schlacht</div>
              <button onClick={() => setShowSamurai(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-900">
                <X size={18} />
              </button>
            </div>
            <iframe
              title="Samurai Schlacht"
              className="w-full h-full bg-black"
              srcDoc={samuraiSrcDoc}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
};
