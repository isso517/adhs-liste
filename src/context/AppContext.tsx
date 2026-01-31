import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppState, AppContextType, Task } from '../types';
import { THEMES, ACHIEVEMENTS } from '../data/constants';
import confetti from 'canvas-confetti';
import { playSound } from '../utils/sound';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'adhs-checklist-v1';

interface SavedState {
  points: number;
  totalPointsEarned: number;
  tasks: Task[];
  unlockedThemeIds: string[];
  activeThemeId: string;
  unlockedAchievementIds: string[];
  claimedAchievementIds: string[];
  lastResetDate: string;
  lastWeeklyResetDate: string;
}

const defaultState: SavedState = {
  points: 0,
  totalPointsEarned: 0,
  tasks: [],
  unlockedThemeIds: ['default'],
  activeThemeId: 'default',
  unlockedAchievementIds: [],
  claimedAchievementIds: [],
  lastResetDate: new Date().toDateString(),
  lastWeeklyResetDate: new Date().toDateString(),
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [savedState, setSavedState] = useState<SavedState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultState;
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      return defaultState;
    }
  });

  // Sync stats to Supabase when points change
  useEffect(() => {
    if (!user) return;

    const syncStats = async () => {
      try {
        const { error } = await supabase
          .from('user_stats')
          .upsert({
            user_id: user.id,
            points: savedState.points,
            total_points: savedState.totalPointsEarned,
            // Calculate task stats
            tasks_completed_daily: savedState.tasks.filter(t => t.completed && t.type === 'daily').length,
            tasks_completed_weekly: savedState.tasks.filter(t => t.completed && t.type === 'weekly').length,
            tasks_completed_monthly: savedState.tasks.filter(t => t.completed && t.type === 'monthly').length,
            active_theme_id: savedState.activeThemeId
          });
        
        if (error) console.error('Error syncing stats:', error);
      } catch (err) {
        console.error('Error in syncStats:', err);
      }
    };

    // Debounce sync slightly to avoid too many requests
    const timer = setTimeout(syncStats, 2000);
    return () => clearTimeout(timer);
  }, [user, savedState.points, savedState.totalPointsEarned, savedState.tasks, savedState.activeThemeId]);

  // Load user data from Supabase on login
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        // 1. Load Stats
        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (stats) {
          setSavedState(prev => ({
            ...prev,
            points: stats.points,
            totalPointsEarned: stats.total_points,
            activeThemeId: stats.active_theme_id || 'default'
          }));
        }

        // 2. Load Tasks (Assuming we implement task sync later fully, for now we keep local tasks but could merge)
        // Ideally, we would fetch tasks from 'tasks' table here if implemented.
        // For this step, we prioritize syncing stats as requested.
        
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    };

    loadUserData();
  }, [user]);

  // Check for daily reset
  useEffect(() => {
    const today = new Date();
    const todayString = today.toDateString();
    
    // Daily Reset
    if (savedState.lastResetDate !== todayString) {
      setSavedState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => (
          t.type === 'daily' 
            ? { ...t, completed: false, completedAt: undefined }
            : t
        )),
        lastResetDate: todayString
      }));
    }

    // Weekly Reset (Monday 00:01)
    // We check if the current week is different from the last reset week
    // Simple approach: Check if it's Monday and last reset was NOT today
    // Or better: Check if today is Monday and last reset date is before today
    const currentDay = today.getDay(); // 1 = Monday
    const lastWeeklyReset = new Date(savedState.lastWeeklyResetDate || 0);
    
    // Check if it's Monday (1) and we haven't reset today yet
    // Also ensuring we don't reset multiple times on the same Monday
    // And if users didn't open app on Monday, we should check if we crossed a Monday.
    // Let's use ISO week logic or simplified:
    // If today is Monday and last reset was < today's date (ignoring time)
    
    const isMonday = currentDay === 1;
    const isNewResetDay = lastWeeklyReset.toDateString() !== todayString;

    if (isMonday && isNewResetDay) {
       setSavedState(prev => ({
        ...prev,
        // Delete weekly tasks from previous week
        tasks: prev.tasks.filter(t => t.type !== 'weekly'),
        lastWeeklyResetDate: todayString
      }));
    }

  }, [savedState.lastResetDate, savedState.lastWeeklyResetDate]);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
  }, [savedState]);

  const appState: AppState = {
    points: savedState.points,
    totalPointsEarned: savedState.totalPointsEarned,
    tasks: savedState.tasks,
    activeThemeId: savedState.activeThemeId,
    themes: THEMES.map(theme => ({
      ...theme,
      unlocked: savedState.unlockedThemeIds.includes(theme.id),
    })),
    achievements: ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      unlocked: savedState.unlockedAchievementIds.includes(achievement.id),
      claimed: savedState.claimedAchievementIds?.includes(achievement.id) || false,
      condition: achievement.condition, // Pass through condition
    })),
  };

  // Check achievements effect
  useEffect(() => {
    const newUnlocks: string[] = [];
    ACHIEVEMENTS.forEach(achievement => {
      if (!savedState.unlockedAchievementIds.includes(achievement.id)) {
        if (achievement.condition(appState)) {
          newUnlocks.push(achievement.id);
        }
      }
    });

    if (newUnlocks.length > 0) {
      setSavedState(prev => ({
        ...prev,
        unlockedAchievementIds: [...prev.unlockedAchievementIds, ...newUnlocks],
      }));
      // Fire confetti!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF4500', '#32CD32', '#1E90FF', '#9370DB']
      });
      console.log('New achievements unlocked:', newUnlocks);
    }
  }, [savedState, appState]);

  const addTask = (text: string, type: 'daily' | 'weekly' | 'monthly' = 'daily', dueDate?: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      type,
      dueDate,
    };
    setSavedState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const toggleTask = (id: string) => {
    setSavedState(prev => {
      const task = prev.tasks.find(t => t.id === id);
      if (!task) return prev;

      const isCompleting = !task.completed;
      const pointsChange = isCompleting ? 1 : -1;

      if (isCompleting) playSound.success();

      // Prevent negative points if user unchecks
      // But maybe we should allow it or just cap at 0? 
      // Requirement says "gut schreibt", implies adding. Unchecking removing points is fair.
      // But if spent, points could go negative?
      // Let's prevent spending points you don't have, but unchecking removes point.
      
      const newPoints = prev.points + pointsChange;
      const newTotal = prev.totalPointsEarned + (isCompleting ? 1 : 0);

      // If unchecking and points would go below 0 (because spent), allow negative? 
      // Or just set to 0? If we set to 0, user can exploit by check->spend->uncheck->check->gain.
      // So we must allow negative or track spent points.
      // Simple approach: Allow negative points temporarily or block unchecking if points < 1?
      // Let's just allow it for now, it's a checklist app not a bank.

      return {
        ...prev,
        tasks: prev.tasks.map(t => 
          t.id === id 
            ? { ...t, completed: isCompleting, completedAt: isCompleting ? Date.now() : undefined } 
            : t
        ),
        points: newPoints,
        totalPointsEarned: newTotal, // Don't decrement total points earned, only current points
      };
    });
  };

  const deleteTask = (id: string) => {
    setSavedState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
  };

  const unlockTheme = (id: string) => {
    const theme = THEMES.find(t => t.id === id);
    if (!theme) return;
    if (savedState.unlockedThemeIds.includes(id)) return;
    if (savedState.points < theme.cost) return;

    setSavedState(prev => ({
      ...prev,
      points: prev.points - theme.cost,
      unlockedThemeIds: [...prev.unlockedThemeIds, id],
    }));
    playSound.purchase();
  };

  const setTheme = (id: string) => {
    if (savedState.unlockedThemeIds.includes(id)) {
      setSavedState(prev => ({ ...prev, activeThemeId: id }));
    }
  };

  const resetDailyTasks = () => {
     setSavedState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => (
          t.type === 'daily' 
            ? { ...t, completed: false, completedAt: undefined }
            : t
        )),
        lastResetDate: new Date().toDateString()
      }));
  };

  const addPoints = (amount: number) => {
    setSavedState(prev => ({
      ...prev,
      points: prev.points + amount,
      totalPointsEarned: prev.totalPointsEarned + amount
    }));
  };

  const claimAchievement = (id: string) => {
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return;
    
    // Check if unlocked and not already claimed
    if (!savedState.unlockedAchievementIds.includes(id)) return;
    if (savedState.claimedAchievementIds?.includes(id)) return;

    setSavedState(prev => ({
      ...prev,
      points: prev.points + achievement.rewardPoints,
      totalPointsEarned: prev.totalPointsEarned + achievement.rewardPoints,
      claimedAchievementIds: [...(prev.claimedAchievementIds || []), id]
    }));

    playSound.success();
    
    // Confetti for claiming
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFD700', '#DAA520'] // Gold colors
    });
  };

  return (
    <AppContext.Provider value={{ ...appState, addTask, toggleTask, deleteTask, unlockTheme, setTheme, resetDailyTasks, addPoints, claimAchievement }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
