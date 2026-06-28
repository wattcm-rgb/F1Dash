import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import PracticePage from './pages/PracticePage';
import QualifyingPage from './pages/QualifyingPage';
import RacePage from './pages/RacePage';
import NewsPage from './pages/NewsPage';
import LivePage from './pages/LivePage';
import Layout from './components/Layout';

export default function App() {
  return (
    <BrowserRouter basename="/F1Dash">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/qualifying" element={<QualifyingPage />} />
          <Route path="/race" element={<RacePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/live" element={<LivePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
