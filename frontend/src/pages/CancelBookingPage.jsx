import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CancelBookingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetchBookingInfo();
  }, [token]);

  const fetchBookingInfo = async () => {
    try {
      const res = await axios.get(`/api/public/cancel/${token}`);
      setBooking(res.data.booking);
      setLoading(false);
    } catch (err) {
      const msg = err.response?.data?.error === 'ya_cancelada'
        ? 'Esta reserva ya fue cancelada'
        : err.response?.data?.error === 'ya_pasada'
        ? 'No se puede cancelar una reserva pasada'
        : 'No se encontró la reserva';
      setError(msg);
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.post(`/api/public/cancel/${token}`);
      setCancelled(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError('Error al cancelar la reserva');
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando detalles de tu reserva...</p>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva Cancelada!</h2>
          <p className="text-gray-600 mb-4">Tu reserva ha sido cancelada exitosamente.</p>
          <p className="text-sm text-gray-500">Serás redirigido en breve...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const date = new Date(booking.datetime_iso);
  const formattedDate = date.toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cancelar Reserva</h1>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <p className="text-gray-900">{booking.client_name}</p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Negocio</label>
            <p className="text-gray-900">{booking.business_name}</p>
          </div>
          {booking.service_name && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
              <p className="text-gray-900">{booking.service_name}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
            <p className="text-gray-900">{formattedDate}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          ¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 font-medium"
            disabled={cancelling}
          >
            Volver
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-red-300"
          >
            {cancelling ? 'Cancelando...' : 'Cancelar Reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
