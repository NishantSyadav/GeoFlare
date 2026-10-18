
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/landingPage";
import AuthPage from "./pages/auth/authPage";
import MapPage from "./pages/mapPage";
import CalendarPage from "./pages/calendarPage";
import TrendsPage from "./pages/trendsPage";
import AnomaliesPage from "./pages/anomaliesPage";
import ReportsPage from "./pages/reportsPage";
import NotFoundPage from "./pages/notFoundPage";
import ProfilePage from "./pages/profilePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/anomalies" element={<AnomaliesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
