import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowLeft } from 'lucide-react';

interface FriendProfile {
  id: string;
  username: string;
  avatar_url?: string;
  user_stats: {
    points: number;
    total_points: number;
    tasks_completed_daily: number;
    tasks_completed_weekly: number;
    tasks_completed_monthly: number;
  };
}

export const FriendProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchFriendProfile();
    }
  }, [id]);

  const fetchFriendProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          user_stats (
            points,
            total_points,
            tasks_completed_daily,
            tasks_completed_weekly,
            tasks_completed_monthly
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Handle stats array/object
      const stats = Array.isArray(data.user_stats) ? data.user_stats[0] : data.user_stats;

      setProfile({
        id: data.id,
        username: data.username,
        avatar_url: data.avatar_url,
        user_stats: stats || {
          points: 0,
          total_points: 0,
          tasks_completed_daily: 0,
          tasks_completed_weekly: 0,
          tasks_completed_monthly: 0
        }
      });
    } catch (err) {
      console.error('Error fetching friend profile:', err);
      alert('Profil konnte nicht geladen werden.');
      navigate('/friends');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;
  if (!profile) return null;

  // Calculate Level (example logic)
  const level = Math.floor(profile.user_stats.total_points / 50) + 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/friends')}
          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Freund-Profil</h2>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center relative overflow-hidden">
        {/* Profile Picture */}
        <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl border-4 border-white shadow-md overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="uppercase">{profile.username.substring(0, 2)}</span>
          )}
        </div>
        
        {/* Username */}
        <div className="flex justify-center items-center gap-2 mb-1">
          <h3 className="text-xl font-bold">{profile.username}</h3>
        </div>
        <p className="text-gray-500 text-sm">Level {level}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Gesamtpunkte</p>
          <p className="text-2xl font-bold">{profile.user_stats.total_points}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Aktuelle Punkte</p>
          <p className="text-2xl font-bold">{profile.user_stats.points}</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2">
          <p className="text-sm text-gray-500">Aufgaben (Woche)</p>
          <p className="text-2xl font-bold">{profile.user_stats.tasks_completed_weekly}</p>
        </div>
      </div>
    </div>
  );
};
