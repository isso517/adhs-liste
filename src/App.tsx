import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { PlannedTasksPage } from './pages/PlannedTasksPage';
import { PointsPage } from './pages/PointsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { AccountPage } from './pages/AccountPage';
import { FriendsPage } from './pages/FriendsPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { FriendProfilePage } from './pages/FriendProfilePage';
import { GamesPage } from './pages/GamesPage';
import { GameLobbyPage } from './pages/GameLobbyPage';
import { GameBoardPage } from './pages/GameBoardPage';
import { LocalGamePage } from './pages/LocalGamePage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<LandingPage />} />
              <Route path="weekly" element={<PlannedTasksPage type="weekly" title="Wochenplanung" />} />
              <Route path="monthly" element={<PlannedTasksPage type="monthly" title="Monatsplanung" />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="friend/:id" element={<FriendProfilePage />} />
              <Route path="games" element={<GamesPage />} />
              <Route path="games/new" element={<GameLobbyPage />} />
              <Route path="game/local" element={<LocalGamePage />} />
              <Route path="game/:id" element={<GameBoardPage />} />
              <Route path="points" element={<PointsPage />} />
              <Route path="achievements" element={<AchievementsPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="login" element={<LoginPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
