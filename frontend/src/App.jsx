import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Bookings from './pages/Bookings';
import Services from './pages/Services';
import Schedules from './pages/Schedules';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import BookingPage from './pages/BookingPage';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Professionals from './pages/Professionals';

function Protected({ children }) {
  const { business } = useAuth();
  return business ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { business } = useAuth();
  return business ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/dashboard" element={<Protected><Layout><Bookings /></Layout></Protected>} />
          <Route path="/dashboard/servicios" element={<Protected><Layout><Services /></Layout></Protected>} />
          <Route path="/dashboard/horarios" element={<Protected><Layout><Schedules /></Layout></Protected>} />
          <Route path="/dashboard/analytics" element={<Protected><Layout><Analytics /></Layout></Protected>} />
          <Route path="/dashboard/configuracion" element={<Protected><Layout><Settings /></Layout></Protected>} />
          <Route path="/dashboard/pacientes" element={<Protected><Layout><Patients /></Layout></Protected>} />
          <Route path="/dashboard/pacientes/:id" element={<Protected><Layout><PatientDetail /></Layout></Protected>} />
          <Route path="/dashboard/profesionales" element={<Protected><Layout><Professionals /></Layout></Protected>} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
