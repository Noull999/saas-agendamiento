import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function MyBookingsPage() {
  const { slug } = useParams();
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [bookings, setBookings] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const res = await axios.get(`/api/public/${slug}/mis-citas?phone=${encodeURIComponent(phone)}`);
      setBookings(res.data.bookings);
      setBusinessName(res.data.business.name);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar tus citas');
      setBookings([]);
    } finally {
      setSearching(false);
    }
  };

  const formatDateTime = (isoStr) => {
    const date = new Date(isoStr);
    return date.toLocaleDateString('es-CL', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    const labels = {
      confirmed: 'Confirmada',
      pending: 'Pendiente',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Citas</h1>
        <p className="text-gray-600 mb-8">Ingresa tu número de teléfono para ver tus próximas citas</p>

        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="+56 9 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 font-medium"
            >
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {bookings !== null && (
          <>
            {businessName && (
              <p className="text-sm text-gray-600 mb-4">
                Citas en <strong>{businessName}</strong>
              </p>
            )}

            {bookings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600 mb-4">No tienes citas próximas registradas</p>
                <Link
                  to={`/book/${slug}`}
                  className="text-blue-500 hover:underline"
                >
                  Agendar una cita
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {booking.service_name || 'Servicio'}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {formatDateTime(booking.datetime_iso)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>
                    {booking.status === 'confirmed' && booking.cancel_token && (
                      <Link
                        to={`/cancel/${booking.cancel_token}`}
                        className="inline-block px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm font-medium transition"
                      >
                        Cancelar Cita
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
