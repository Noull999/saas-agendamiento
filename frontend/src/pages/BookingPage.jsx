import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getVertical } from '../config/verticals.config';
import { isValidRut } from '../utils/rut';
import { useToast } from '../context/ToastContext';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function getDatesForNextDays(n = 30) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const STEP_LABELS = ['Servicio', 'Fecha', 'Hora', 'Datos'];

const formatPrice = (p) => p && Number(p) > 0
  ? `$${Number(p).toLocaleString('es-CL')}`
  : 'Gratis';

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              done || active ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-red-500' : 'bg-zinc-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', client_rut: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [cancelToken, setCancelToken] = useState(null);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    axios.get(`/api/public/${slug}`)
      .then(({ data }) => setProfile(data))
      .catch(() => setError('Negocio no encontrado'));
  }, [slug]);

  // Show a banner when returning from Mercado Pago
  useEffect(() => {
    const paymentResult = searchParams.get('payment');
    if (paymentResult === 'success') toast.success('¡Pago recibido! Tu reserva está confirmada.');
    else if (paymentResult === 'failure') toast.error('El pago fue rechazado. Puedes intentarlo de nuevo o pagar en la consulta.');
    else if (paymentResult === 'pending') toast.info?.('Pago pendiente de acreditación. Te notificaremos cuando se confirme.');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setAvailableSlots([]);
    setLoadingSlots(true);
    const dateStr = selectedDate.toISOString().slice(0, 10);
    axios.get(`/api/public/${slug}/slots`, {
      params: { date: dateStr, days: 1, service_id: selectedService.id },
    })
      .then(({ data }) => {
        const day = data.find(d => d.date === dateStr);
        setAvailableSlots(day ? day.slots : []);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedService, slug]);

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500">{error}</p>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { business, services, schedules } = profile;
  const vertical = getVertical(business?.vertical);
  const showRut = vertical.booking.showRut;

  const availableDates = getDatesForNextDays(30).filter((d) => {
    const sched = schedules.find((s) => s.dow === d.getDay());
    return sched && sched.slots.length > 0;
  });

  const handleSubmit = async () => {
    if (!form.client_name) return;
    setSubmitting(true);
    try {
      const datetime_iso = `${selectedDate.toISOString().slice(0, 10)}T${selectedSlot}:00`;
      const { data } = await axios.post(`/api/bookings/public/${slug}`, {
        client_name: form.client_name,
        client_email: form.client_email || undefined,
        client_phone: form.client_phone || undefined,
        client_rut: form.client_rut || undefined,
        service_id: selectedService?.id,
        datetime_iso,
        notes: form.notes || undefined,
      });
      if (data.cancel_token) setCancelToken(data.cancel_token);
      setCreatedBooking(data);

      // If the business has MP enabled and the service has a price, offer payment
      const hasMp = profile?.business?.mp_enabled;
      const hasPrice = selectedService?.price && Number(selectedService.price) > 0;
      if (hasMp && hasPrice) {
        setStep(5); // payment choice step
      } else {
        setStep(6); // confirmation (no payment)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentNow = async () => {
    if (!createdBooking) return;
    setPaymentLoading(true);
    try {
      const { data } = await axios.post('/api/payments/preference', {
        booking_id: createdBooking.id,
        service_id: selectedService?.id,
        amount: selectedService?.price,
        client_email: form.client_email || undefined,
        client_name: form.client_name,
      });
      window.location.href = data.init_point;
    } catch (err) {
      toast.error('Error iniciando pago: ' + (err.response?.data?.error || err.message));
      setPaymentLoading(false);
    }
  };

  const handlePaymentLater = () => {
    setStep(6); // go to confirmation screen
  };

  const inputClass = 'mt-1.5 w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-black">
      {/* Left panel */}
      <div className="lg:w-80 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b lg:border-b-0 lg:border-r border-zinc-800 text-white p-8 lg:p-10 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-red-500/30">
            {business.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{business.name}</h1>
            <p className="text-zinc-500 text-xs">Reserva en línea</p>
          </div>
        </div>

        {step >= 2 && selectedService && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Servicio seleccionado</p>
            <p className="font-semibold text-white">{selectedService.name}</p>
            {selectedService.description && (
              <p className="text-zinc-400 text-xs">{selectedService.description}</p>
            )}
            <div className="flex gap-3 pt-1">
              <span className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">⏱ {selectedService.duration_min} min</span>
              {selectedService.price && (
                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-medium">
                  ${Number(selectedService.price).toLocaleString('es-CL')}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-auto">
            <p className="text-zinc-500 text-sm">Elige un servicio para comenzar tu reserva.</p>
          </div>
        )}

        {step >= 3 && selectedDate && (
          <div className="mt-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Fecha</p>
            <p className="font-semibold capitalize text-white">
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
            </p>
            {step >= 4 && selectedSlot && (
              <p className="text-zinc-400 text-sm mt-1">🕐 {selectedSlot} hrs</p>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-black p-8 lg:p-12 overflow-auto">

        {/* Step 5: Opción de pago */}
        {step === 5 && (
          <div className="max-w-md mx-auto pt-8">
            <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">💳</div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">¿Cómo deseas pagar?</h2>
            <p className="text-zinc-400 mb-8 text-center text-sm">Tu reserva está confirmada. Puedes pagar ahora o al momento de la consulta.</p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm space-y-2 mb-8">
              {selectedService && <div className="flex justify-between"><span className="text-zinc-500">Servicio</span><span className="font-medium text-white">{selectedService.name}</span></div>}
              {selectedDate && <div className="flex justify-between"><span className="text-zinc-500">Fecha</span><span className="font-medium capitalize text-white">{DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</span></div>}
              {selectedSlot && <div className="flex justify-between"><span className="text-zinc-500">Hora</span><span className="font-medium text-white">{selectedSlot} hrs</span></div>}
              {selectedService?.price && (
                <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
                  <span className="text-zinc-500">Total</span>
                  <span className="font-bold text-white">${Number(selectedService.price).toLocaleString('es-CL')}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handlePaymentNow}
                disabled={paymentLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {paymentLoading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Redirigiendo...</span>
                ) : (
                  <>💳 Pagar ahora — ${Number(selectedService?.price || 0).toLocaleString('es-CL')}</>
                )}
              </button>
              <button
                onClick={handlePaymentLater}
                disabled={paymentLoading}
                className="w-full py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl font-medium transition-colors text-sm"
              >
                📍 Pagar en la consulta
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Confirmación */}
        {step === 6 && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Reserva confirmada!</h2>
            <p className="text-zinc-400 mb-8">Tu hora ha sido agendada exitosamente en <strong className="text-white">{business.name}</strong>.</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left text-sm space-y-3 mb-8">
              {selectedService && <div className="flex justify-between"><span className="text-zinc-500">Servicio</span><span className="font-medium text-white">{selectedService.name}</span></div>}
              {selectedDate && <div className="flex justify-between"><span className="text-zinc-500">Fecha</span><span className="font-medium capitalize text-white">{DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</span></div>}
              {selectedSlot && <div className="flex justify-between"><span className="text-zinc-500">Hora</span><span className="font-medium text-white">{selectedSlot} hrs</span></div>}
              <div className="flex justify-between"><span className="text-zinc-500">Nombre</span><span className="font-medium text-white">{form.client_name}</span></div>
            </div>
            {form.client_phone && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                📱 Te enviaremos la confirmación al WhatsApp {form.client_phone}
              </p>
            )}

            {/* Links útiles para el paciente */}
            <div className="flex flex-col gap-2 mb-6">
              <a
                href={`/book/${slug}/mis-citas`}
                className="block text-center text-sm bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 text-zinc-300 hover:bg-zinc-800 font-medium transition-colors"
              >
                📅 Ver mis citas
              </a>
              {cancelToken && (
                <a
                  href={`/cancel/${cancelToken}`}
                  className="block text-center text-sm text-zinc-500 hover:text-red-400 py-1 transition-colors"
                >
                  Cancelar esta reserva
                </a>
              )}
            </div>

            <button
              onClick={() => { setStep(1); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); setCancelToken(null); setCreatedBooking(null); setForm({ client_name: '', client_email: '', client_phone: '', client_rut: '', notes: '' }); }}
              className="text-sm text-red-400 hover:text-red-300 hover:underline transition-colors"
            >
              Agendar otra hora
            </button>
          </div>
        )}

        {step < 5 && step >= 1 && (
          <div className="max-w-md mx-auto">
            <ProgressBar step={step} />

            {/* Step 1: Servicio */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-white mb-1">¿Qué servicio necesitas?</h2>
                <p className="text-zinc-500 text-sm mb-6">Selecciona el servicio para tu cita</p>
                {services.length === 0 && <p className="text-zinc-600 text-sm">Este negocio no tiene servicios configurados aún.</p>}
                <div className="grid grid-cols-1 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedService(s); setStep(2); }}
                      className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selectedService?.id === s.id
                          ? 'border-red-500 bg-red-500/10 text-white'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-white">{s.name}</div>
                        {s.description && <div className="text-xs text-zinc-500 mt-0.5">{s.description}</div>}
                        {s.duration_min != null && (
                          <div className="text-xs text-zinc-400 mt-0.5">{s.duration_min} min</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-red-400 shrink-0 ml-4">
                        {formatPrice(s.price)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Fecha */}
            {step === 2 && (
              <div>
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-white mb-1">Elige una fecha</h2>
                <p className="text-zinc-500 text-sm mb-6">Fechas disponibles en los próximos 30 días</p>
                {availableDates.length === 0 && <p className="text-zinc-600 text-sm">No hay fechas disponibles en los próximos 30 días.</p>}
                <div className="grid grid-cols-3 gap-2">
                  {availableDates.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => { setSelectedDate(d); setStep(3); }}
                      className="p-3 bg-zinc-900 border-2 border-zinc-800 rounded-2xl hover:border-red-500 hover:bg-zinc-900/70 transition-all text-center group"
                    >
                      <p className="text-xs text-zinc-500 capitalize group-hover:text-red-400 transition-colors">{DAYS[d.getDay()].slice(0, 3)}</p>
                      <p className="font-bold text-white text-lg leading-tight">{d.getDate()}</p>
                      <p className="text-xs text-zinc-500 capitalize">{MONTHS[d.getMonth()].slice(0, 3)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Hora */}
            {step === 3 && (
              <div>
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-white mb-1">Elige un horario</h2>
                <p className="text-zinc-500 text-sm mb-6">Horarios disponibles para el día seleccionado</p>
                {loadingSlots && (
                  <div className="flex justify-center py-8">
                    <div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!loadingSlots && availableSlots.length === 0 && (
                  <p className="text-zinc-600 text-sm">No hay horarios disponibles para este día.</p>
                )}
                {!loadingSlots && availableSlots.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => { setSelectedSlot(slot); setStep(4); }}
                        className="py-3 bg-zinc-900 border-2 border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-300 hover:border-red-500 hover:bg-zinc-900/70 hover:text-red-400 transition-all"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Datos */}
            {step === 4 && (
              <div>
                <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-white mb-1">Tus datos de contacto</h2>
                <p className="text-zinc-500 text-sm mb-6">Para enviarte la confirmación de tu reserva</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Nombre completo *</label>
                    <input
                      required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className={inputClass}
                      placeholder="Tu nombre"
                    />
                  </div>
                  {showRut && (
                    <div>
                      <label className="text-xs font-semibold text-zinc-300">
                        RUT *{' '}
                        {form.client_rut.length > 2 && (
                          isValidRut(form.client_rut)
                            ? <span className="text-emerald-400 font-normal">✓ válido</span>
                            : <span className="text-red-400 font-normal">inválido</span>
                        )}
                      </label>
                      <input
                        required value={form.client_rut}
                        onChange={(e) => setForm({ ...form, client_rut: e.target.value })}
                        placeholder="ej: 12.345.678-9"
                        className={inputClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Teléfono WhatsApp *</label>
                    <input
                      required value={form.client_phone}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className={inputClass}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Recibirás la confirmación por WhatsApp</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Email <span className="font-normal text-zinc-500">(opcional)</span></label>
                    <input
                      type="email" value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Notas adicionales</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className={`${inputClass} resize-none`}
                      placeholder="Algo que el negocio deba saber..."
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !form.client_name || !form.client_phone ||
                      (showRut && !isValidRut(form.client_rut))}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl py-3.5 text-sm font-bold hover:from-red-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2 shadow-lg shadow-red-500/20"
                  >
                    {submitting ? 'Agendando...' : 'Confirmar reserva →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
