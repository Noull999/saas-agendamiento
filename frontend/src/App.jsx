import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Carga inmediata: páginas pequeñas necesarias antes del primer render
import Login      from './pages/Login';
import Register   from './pages/Register';
import BookingPage from './pages/BookingPage'; // pública, sin auth

// Carga diferida: páginas del dashboard (~95% del bundle)
// Se descargan solo cuando el usuario navega a ellas por primera vez
const Bookings      = lazy(() => import('./pages/Bookings'));
const Services      = lazy(() => import('./pages/Services'));
const Schedules     = lazy(() => import('./pages/Schedules'));
const Analytics     = lazy(() => import('./pages/Analytics'));
const Settings      = lazy(() => import('./pages/Settings'));
const PageBuilder   = lazy(() => import('./pages/PageBuilder'));
const Patients      = lazy(() => import('./pages/Patients'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Professionals = lazy(() => import('./pages/Professionals'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: '200px',
      color: '#6b7280',
      fontSize: '14px',
    }}>
      Cargando…
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"    element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

            <Route path="/dashboard"                 element={<Protected><Layout><Bookings /></Layout></Protected>} />
            <Route path="/dashboard/servicios"       element={<Protected><Layout><Services /></Layout></Protected>} />
            <Route path="/dashboard/horarios"        element={<Protected><Layout><Schedules /></Layout></Protected>} />
            <Route path="/dashboard/analytics"       element={<Protected><Layout><Analytics /></Layout></Protected>} />
            <Route path="/dashboard/diseño"          element={<Protected><Layout><PageBuilder /></Layout></Protected>} />
            <Route path="/dashboard/configuracion"   element={<Protected><Layout><Settings /></Layout></Protected>} />
            <Route path="/dashboard/pacientes"       element={<Protected><Layout><Patients /></Layout></Protected>} />
            <Route path="/dashboard/pacientes/:id"   element={<Protected><Layout><PatientDetail /></Layout></Protected>} />
            <Route path="/dashboard/profesionales"   element={<Protected><Layout><Professionals /></Layout></Protected>} />

            <Route path="/book/:slug" element={<BookingPage />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
