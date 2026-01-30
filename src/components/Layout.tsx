import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { CheckSquare, ShoppingBag, User, Coins, Sparkles, Calendar, CalendarDays } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { clsx } from 'clsx';

export const Layout: React.FC = () => {
  const { themes, activeThemeId, points } = useApp();
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];

  const navItems = [
    { to: '/', icon: CheckSquare, label: 'Täglich' },
    { to: '/weekly', icon: Calendar, label: 'Woche' },
    { to: '/monthly', icon: CalendarDays, label: 'Monat' },
    { to: '/points', icon: ShoppingBag, label: 'Shop' },
    { to: '/account', icon: User, label: 'Konto' },
  ];

  return (
    <div className={clsx("min-h-screen flex flex-col transition-colors duration-300", activeTheme.colors.background, activeTheme.colors.text)}>
      {/* Top Bar */}
      <header className="p-4 sticky top-0 z-10 shadow-sm transition-colors duration-300 bg-gray-100 text-gray-900">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="relative">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent animate-rainbow">
              ADHS Checkliste
            </h1>
            <Sparkles className="absolute -top-3 -right-5 text-yellow-400 animate-twinkle" size={18} />
            <Sparkles className="absolute -bottom-2 -left-5 text-yellow-400 animate-twinkle" style={{ animationDelay: '0.5s' }} size={14} />
          </div>
          <div className="flex items-center gap-2 bg-black/5 px-3 py-1 rounded-full">
            <Coins size={18} className="text-yellow-600" />
            <span className="font-bold">{points}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 max-w-md mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className={clsx("fixed bottom-0 left-0 right-0 border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700")}>
        <div className="flex justify-around items-center max-w-md mx-auto h-16">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center w-full h-full transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                )
              }
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
