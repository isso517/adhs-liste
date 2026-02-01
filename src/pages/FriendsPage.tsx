import React, { useState, useEffect } from 'react';
import { Users, Trophy, UserPlus, Crown, Search, Loader2, Copy, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LoginPage } from './LoginPage';
import { useNavigate } from 'react-router-dom';

type TimeFrame = 'daily' | 'weekly' | 'monthly';

interface FriendData {
  id: string;
  username: string;
  avatar_url?: string;
  friend_code?: string;
  points: number;
  total_points: number;
  tasks_completed_daily: number;
  tasks_completed_weekly: number;
  tasks_completed_monthly: number;
}

export const FriendsPage: React.FC = () => {
  const { themes, activeThemeId } = useApp();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'friends'>('leaderboard');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const primaryTextClass = activeTheme.colors.primary.includes('text-') ? '' : 'text-white';
  
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);

  const getDisplayName = (name?: string | null) => {
    if (name && name.trim()) return name;
    return 'Unbekannt';
  };

  const getInitials = (name?: string | null) => getDisplayName(name).substring(0, 2).toUpperCase();

  useEffect(() => {
    if (user) {
      fetchFriends();

      // Subscribe to realtime changes for user_stats
      const channel = supabase
        .channel('public:user_stats')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_stats',
          },
          (payload) => {
            const newStats = payload.new as any;
            setFriends((currentFriends) => 
              currentFriends.map((friend) => {
                if (friend.id === newStats.user_id) {
                  return {
                    ...friend,
                    points: newStats.points,
                    total_points: newStats.total_points,
                    tasks_completed_daily: newStats.tasks_completed_daily,
                    tasks_completed_weekly: newStats.tasks_completed_weekly,
                    tasks_completed_monthly: newStats.tasks_completed_monthly,
                  };
                }
                return friend;
              })
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      // Fetch confirmed friendships
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          user_id
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      // Extract friend IDs
      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      // Include self
      friendIds.push(user.id);

      // Fetch profiles and stats for all friends + self
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          friend_code,
          user_stats (
            points,
            total_points,
            tasks_completed_daily,
            tasks_completed_weekly,
            tasks_completed_monthly
          )
        `)
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      const formattedFriends: FriendData[] = profiles.map((p: any) => {
        // Handle user_stats being returned as array or single object
        const stats = Array.isArray(p.user_stats) ? p.user_stats[0] : p.user_stats;
        
        return {
          id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          friend_code: p.friend_code,
          points: stats?.points || 0,
          total_points: stats?.total_points || 0,
          tasks_completed_daily: stats?.tasks_completed_daily || 0,
          tasks_completed_weekly: stats?.tasks_completed_weekly || 0,
          tasks_completed_monthly: stats?.tasks_completed_monthly || 0,
        };
      });

      setFriends(formattedFriends);
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message || 'Fehler beim Laden der Freundesliste.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!searchQuery.trim() || !user) return;
    setAddFriendLoading(true);

    try {
      // Find user by friend code
      const { data: friendProfile, error: searchError } = await supabase
        .rpc('get_user_by_friend_code', { code_input: searchQuery.trim() })
        .single();

      if (searchError || !friendProfile) {
        alert('Benutzer mit diesem Code nicht gefunden.');
        setAddFriendLoading(false);
        return;
      }

      // Cast friendProfile to any or specific type since rpc return type might not be inferred correctly
      const friend = friendProfile as any;

      if (friend.id === user.id) {
        alert('Du kannst dich nicht selbst hinzufügen.');
        setAddFriendLoading(false);
        return;
      }

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${user.id})`)
        .single();

      if (existing) {
        alert('Freundschaftsanfrage existiert bereits oder ihr seid schon Freunde.');
        setAddFriendLoading(false);
        return;
      }

      // Create friendship
      const { error: addError } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friend.id,
          status: 'accepted'
        });

      if (addError) throw addError;

      alert(`${friend.username} wurde hinzugefügt!`);
      setSearchQuery('');
      fetchFriends();
    } catch (err) {
      console.error('Error adding friend:', err);
      alert('Fehler beim Hinzufügen.');
    } finally {
      setAddFriendLoading(false);
    }
  };

  const getTimeFrameLabel = (tf: TimeFrame) => {
    switch (tf) {
      case 'daily': return 'Heute';
      case 'weekly': return 'Diese Woche';
      case 'monthly': return 'Diesen Monat';
    }
  };

  const getPoints = (friend: FriendData) => {
    // This assumes points in DB are total current points. 
    // If we want time-framed points, we'd need to track history.
    // For now, let's use:
    // Daily: daily tasks count * 10 (approx)
    // Weekly: weekly tasks count * 20 (approx)
    // Monthly: monthly tasks count * 50 (approx)
    // OR just return total points for simplicity if specific stats aren't granular enough
    
    // Better: return total points for leaderboard, but maybe show task counts for timeframe
    return friend.points; 
  };
  
  const getTasksCount = (friend: FriendData) => {
     switch (timeFrame) {
      case 'daily': return friend.tasks_completed_daily;
      case 'weekly': return friend.tasks_completed_weekly;
      case 'monthly': return friend.tasks_completed_monthly;
    }
  };

  const sortedFriends = [...friends].sort((a, b) => getPoints(b) - getPoints(a));

  if (authLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center justify-center gap-4 relative">
        <h2 className={clsx("text-2xl font-bold drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] text-center w-full", activeTheme.colors.text)}>Social Hub</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              activeTab === 'leaderboard' ? clsx(activeTheme.colors.primary, primaryTextClass) : "bg-gray-200 text-gray-900"
            )}
          >
            <Trophy size={20} />
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              activeTab === 'friends' ? clsx(activeTheme.colors.primary, primaryTextClass) : "bg-gray-200 text-gray-900"
            )}
          >
            <Users size={20} />
          </button>
        </div>
      </div>

      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex justify-center">
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
              {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    timeFrame === tf 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-900 hover:text-gray-900"
                  )}
                >
                  {getTimeFrameLabel(tf)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : error ? (
            <div className="text-center text-red-500 py-10 bg-red-50 rounded-xl border border-red-100 p-4">
              <p className="font-bold">Fehler</p>
              <p className="text-sm">{error}</p>
              <button onClick={fetchFriends} className="mt-2 text-xs bg-red-100 px-3 py-1 rounded hover:bg-red-200 transition-colors text-red-700">Erneut versuchen</button>
            </div>
          ) : sortedFriends.length === 0 ? (
            <div className="text-center text-gray-900 py-10">
              Noch keine Freunde. Füge jemanden hinzu!
            </div>
          ) : (
            <>
              {/* Podium */}
              {sortedFriends.length >= 2 && (
                <div className="flex justify-center items-end gap-4 py-4 min-h-[200px]">
                  {/* 2nd Place */}
                  {sortedFriends[1] && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-300 border-4 border-gray-400 flex items-center justify-center text-xl font-bold text-gray-900 uppercase">
                        {getInitials(sortedFriends[1].username)}
                      </div>
                      <div className="flex flex-col items-center bg-gray-200/50 p-3 rounded-t-lg w-24 h-28 justify-end relative text-gray-900">
                        <div className="absolute -top-3 bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">#2</div>
                        <span className="font-bold truncate w-full text-center">{getDisplayName(sortedFriends[1].username)}</span>
                        <span className="text-xs">{getPoints(sortedFriends[1])} Pkt</span>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {sortedFriends[0] && (
                    <div className="flex flex-col items-center gap-2 z-10">
                      <Crown className="text-yellow-500 animate-bounce" size={24} />
                      <div className="w-20 h-20 rounded-full bg-yellow-100 border-4 border-yellow-400 flex items-center justify-center text-2xl font-bold text-yellow-700 shadow-lg uppercase">
                         {getInitials(sortedFriends[0].username)}
                      </div>
                      <div className="flex flex-col items-center bg-gradient-to-b from-yellow-100 to-yellow-50/50 p-3 rounded-t-lg w-28 h-36 justify-end relative shadow-sm text-gray-900">
                        <div className="absolute -top-3 bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">#1</div>
                        <span className="font-bold truncate w-full text-center">{getDisplayName(sortedFriends[0].username)}</span>
                        <span className="text-sm font-bold">{getPoints(sortedFriends[0])} Pkt</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {sortedFriends[2] && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-orange-100 border-4 border-orange-300 flex items-center justify-center text-xl font-bold text-orange-700 uppercase">
                         {getInitials(sortedFriends[2].username)}
                      </div>
                      <div className="flex flex-col items-center bg-orange-50/50 p-3 rounded-t-lg w-24 h-20 justify-end relative text-gray-900">
                        <div className="absolute -top-3 bg-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">#3</div>
                        <span className="font-bold truncate w-full text-center">{getDisplayName(sortedFriends[2].username)}</span>
                        <span className="text-xs">{getPoints(sortedFriends[2])} Pkt</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* List View */}
              <div className="bg-white/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm border border-gray-100 text-gray-900">
                {/* Show top 10 friends, including podium places for full visibility as requested */}
                {sortedFriends.slice(0, 10).map((friend, index) => (
                  <div key={friend.id} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-white/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono w-6 text-center font-bold">{index + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-900 uppercase">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          getInitials(friend.username)
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{getDisplayName(friend.username)}</div>
                        <div className="text-xs">{getTasksCount(friend)} Aufgaben erledigt</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-bold">{getPoints(friend)} Pkt</div>
                      <button 
                        onClick={() => navigate(`/friend/${friend.id}`)}
                        className="p-1.5 text-gray-900 hover:text-gray-900 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Profil ansehen"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'friends' && (
        <div className="space-y-6">
          {/* Add Friend */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4 text-gray-900">
            <h3 className="font-semibold flex items-center gap-2">
              <UserPlus size={18} />
              Freund hinzufügen
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900" size={16} />
                <input
                  type="text"
                  placeholder="Freundes-Code eingeben..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
              </div>
              <button 
                onClick={handleAddFriend}
                disabled={addFriendLoading || !searchQuery.trim()}
                className={clsx(
                  "px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2", 
                  activeTheme.colors.primary,
                  addFriendLoading && "opacity-70 cursor-not-allowed"
                )}
              >
                {addFriendLoading ? <Loader2 className="animate-spin" size={16} /> : 'Adden'}
              </button>
            </div>
            
            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-900 mb-2">Dein Einladungs-Code</div>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 border-dashed group cursor-pointer" onClick={() => {
                if (profile?.friend_code) {
                  navigator.clipboard.writeText(profile.friend_code);
                  alert('Code kopiert!');
                }
              }}>
                <code className="flex-1 text-center font-mono text-lg font-bold tracking-wider text-gray-900">
                  {profile?.friend_code || 'Loading...'}
                </code>
                <button className="p-1.5 hover:bg-gray-200 rounded-md text-gray-900 transition-colors">
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Friend List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 px-1">Deine Freunde ({friends.length - 1})</h3>
            {friends.filter(f => f.id !== user.id).map(friend => (
              <div key={friend.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors text-gray-900" onClick={() => navigate(`/friend/${friend.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase overflow-hidden">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(friend.username)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{getDisplayName(friend.username)}</div>
                    <div className="text-xs">{friend.points} Punkte</div>
                  </div>
                </div>
                <Eye size={18} className="text-gray-900" />
              </div>
            ))}
            {friends.length <= 1 && (
               <div className="text-center text-gray-900 py-4 text-sm">
                 Du hast noch keine Freunde hinzugefügt.
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
