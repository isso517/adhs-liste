import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { PlannedTasksPage } from './pages/PlannedTasksPage';
import { PointsPage } from './pages/PointsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { AccountPage } from './pages/AccountPage';

const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.DEV ? '/' : '/adhs-liste'}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="weekly" element={<PlannedTasksPage type="weekly" title="Wochenplanung" />} />
            <Route path="monthly" element={<PlannedTasksPage type="monthly" title="Monatsplanung" />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
