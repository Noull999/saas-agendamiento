import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDatetime(iso) {
  const d = new Date(iso);
  const day  = DAYS_ES[d.getDay()];
  const date = d.getDate();
  const mon  = MONTHS_ES[d.getMonth()];
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${date} de ${mon} a las ${time}`;
}

export default function CancelBookingPage() {
  const { token } = useParams();
  const [booking,    setBooking]    = useState(null);
  const [state,      setState]      = useState('loading'); // loading | preview | cancelling | done | error
  const [errorMsg,   setErrorMsg]   = useState('');

  useEffect(() => {
    axios.get(`/api/public/cancel/${token}`)
      .then(({ data }) => { setBooking(data.booking); setState('preview'); })
      .catch(err => {
        const code = err.response?.data?.error;
        if (code === 'ya_cancelada') setState('already_cancelled');
        else if (code === 'ya_pasada') setState('past');
        else { setErrorMsg('Enlace de cancelación inválido o expirado.'); setState('error'); }
      });
  }, [token]);

  const confirmCancel = async () => {
    setState('cancelling');
    try {
      await axios.post(`/api/public/cancel/${token}`);
      setState('done');
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'ya_cancelada') setState('already_cancelled');
      else if (code === 'ya_pasada') setState('past');
      else { setErrorMsg('No se pudo cancelar. Intenta de nuevo.'); setState('error'); }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-8">

        {/* Loading */}
        {state === 'loading' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-500 text-sm mt-3">Verificando enlace…</p>
          </div>
        )}

        {/* Preview — confirm cancellation */}
        {state === 'preview' && booking && (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🗓️</div>
              <h1 className="text-xl font-bold text-white">¿Cancelar tu reserva?</h1>
              <p className="text-zinc-400 text-sm mt-1">Esta acción no se puede deshacer</p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Negocio</span>
                <span className="font-medium text-white">{booking.business_name}</span>
              </div>
              {booking.service_name && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Servicio</span>
                  <span className="font-medium text-white">{booking.service_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Fecha</span>
                <span className="font-medium text-white text-right capitalize">{formatDatetime(booking.datetime_iso)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nombre</span>
                <span className="font-medium text-white">{booking.client_name}</span>
              </div>
            </div>

            <button
              onClick={confirmCancel}
              className="w-full bg-red-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-red-700 transition-colors"
            >
              Sí, cancelar mi reserva
            </button>
            <a
              href="/"
              className="block text-center mt-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              No cancelar, volver al inicio
            </a>
          </>
        )}

        {/* Cancelling spinner */}
        {state === 'cancelling' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-500 text-sm mt-3">Cancelando reserva…</p>
          </div>
        )}

        {/* Done */}
        {state === 'done' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
            <h1 className="text-xl font-bold text-white mb-2">Reserva cancelada</h1>
            <p className="text-zinc-400 text-sm">Tu reserva ha sido cancelada exitosamente.</p>
          </div>
        )}

        {/* Already cancelled */}
        {state === 'already_cancelled' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">ℹ️</div>
            <h1 className="text-xl font-bold text-white mb-2">Ya fue cancelada</h1>
            <p className="text-zinc-400 text-sm">Esta reserva ya estaba cancelada anteriormente.</p>
          </div>
        )}

        {/* Past */}
        {state === 'past' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">⏰</div>
            <h1 className="text-xl font-bold text-white mb-2">Cita ya realizada</h1>
            <p className="text-zinc-400 text-sm">No es posible cancelar una cita que ya ocurrió.</p>
          </div>
        )}

        {/* Generic error */}
        {state === 'error' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">❌</div>
            <h1 className="text-xl font-bold text-white mb-2">Enlace inválido</h1>
            <p className="text-zinc-400 text-sm">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
