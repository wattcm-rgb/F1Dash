import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import QualifyingPage from './pages/QualifyingPage';
import SprintQualifyingPage from './pages/SprintQualifyingPage';
import RacePage from './pages/RacePage';
import SprintPage from './pages/SprintPage';
import NewsPage from './pages/NewsPage';
import LivePage from './pages/LivePage';
import StandingsPage from './pages/StandingsPage';
import Layout from './components/Layout';

export default function App() {
  return (
    <BrowserRouter basename="/F1Dash">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/qualifying" element={<QualifyingPage />} />
          <Route path="/sprint-qualifying" element={<SprintQualifyingPage />} />
          <Route path="/race" element={<RacePage />} />
          <Route path="/sprint" element={<SprintPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/standings" element={<StandingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
