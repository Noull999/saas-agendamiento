import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

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
              done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`/api/public/${slug}`)
      .then(({ data }) => setProfile(data))
      .catch(() => setError('Negocio no encontrado'));
  }, [slug]);

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">{error}</p>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { business, services, schedules } = profile;

  const availableDates = getDatesForNextDays(30).filter((d) => {
    const sched = schedules.find((s) => s.dow === d.getDay());
    return sched && sched.slots.length > 0;
  });

  const slotsForDate = selectedDate
    ? (schedules.find((s) => s.dow === selectedDate.getDay())?.slots || [])
    : [];

  const handleSubmit = async () => {
    if (!form.client_name) return;
    setSubmitting(true);
    try {
      const datetime_iso = `${selectedDate.toISOString().slice(0, 10)}T${selectedSlot}:00`;
      await axios.post(`/api/bookings/public/${slug}`, {
        client_name: form.client_name,
        client_email: form.client_email || undefined,
        client_phone: form.client_phone || undefined,
        service_id: selectedService?.id,
        datetime_iso,
        notes: form.notes || undefined,
      });
      setStep(5);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'mt-1.5 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="lg:w-80 bg-gradient-to-b from-slate-900 to-indigo-900 text-white p-8 lg:p-10 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-bold text-lg">
            {business.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{business.name}</h1>
            <p className="text-indigo-300 text-xs">Reserva en línea</p>
          </div>
        </div>

        {step >= 2 && selectedService && (
          <div className="bg-white/10 rounded-2xl p-5 space-y-3">
            <p className="text-xs text-indigo-300 uppercase tracking-wider font-medium">Servicio seleccionado</p>
            <p className="font-semibold text-white">{selectedService.name}</p>
            {selectedService.description && (
              <p className="text-indigo-200 text-xs">{selectedService.description}</p>
            )}
            <div className="flex gap-3 pt-1">
              <span className="text-xs bg-white/10 px-3 py-1 rounded-full">⏱ {selectedService.duration_min} min</span>
              {selectedService.price && (
                <span className="text-xs bg-indigo-500/50 px-3 py-1 rounded-full font-medium">
                  ${Number(selectedService.price).toLocaleString('es-CL')}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-auto">
            <p className="text-indigo-300 text-sm">Elige un servicio para comenzar tu reserva.</p>
          </div>
        )}

        {step >= 3 && selectedDate && (
          <div className="mt-4 bg-white/10 rounded-2xl p-4">
            <p className="text-xs text-indigo-300 mb-1">Fecha</p>
            <p className="font-semibold capitalize">
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
            </p>
            {step >= 4 && selectedSlot && (
              <p className="text-indigo-200 text-sm mt-1">🕐 {selectedSlot} hrs</p>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white p-8 lg:p-12 overflow-auto">

        {/* Step 5: Confirmación */}
        {step === 5 && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">✅</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Reserva confirmada!</h2>
            <p className="text-slate-500 mb-8">Tu hora ha sido agendada exitosamente en <strong>{business.name}</strong>.</p>
            <div className="bg-slate-50 rounded-2xl p-5 text-left text-sm space-y-3 mb-8">
              {selectedService && <div className="flex justify-between"><span className="text-slate-500">Servicio</span><span className="font-medium">{selectedService.name}</span></div>}
              {selectedDate && <div className="flex justify-between"><span className="text-slate-500">Fecha</span><span className="font-medium capitalize">{DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</span></div>}
              {selectedSlot && <div className="flex justify-between"><span className="text-slate-500">Hora</span><span className="font-medium">{selectedSlot} hrs</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Nombre</span><span className="font-medium">{form.client_name}</span></div>
            </div>
            {form.client_phone && (
              <p className="text-sm text-indigo-600 bg-indigo-50 rounded-xl px-4 py-3 mb-6">
                📱 Te enviaremos la confirmación al {form.client_phone}
              </p>
            )}
            <button
              onClick={() => { setStep(1); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); setForm({ client_name: '', client_email: '', client_phone: '', notes: '' }); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Agendar otra hora
            </button>
          </div>
        )}

        {step < 5 && (
          <div className="max-w-md mx-auto">
            <ProgressBar step={step} />

            {/* Step 1: Servicio */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">¿Qué servicio necesitas?</h2>
                <p className="text-slate-500 text-sm mb-6">Selecciona el servicio para tu cita</p>
                {services.length === 0 && <p className="text-slate-400 text-sm">Este negocio no tiene servicios configurados aún.</p>}
                <div className="space-y-3">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s); setStep(2); }}
                      className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700">{s.name}</p>
                          {s.description && <p className="text-slate-400 text-xs mt-0.5">{s.description}</p>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm text-slate-500">{s.duration_min} min</p>
                          {s.price && <p className="text-xs font-semibold text-indigo-600">${Number(s.price).toLocaleString('es-CL')}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Fecha */}
            {step === 2 && (
              <div>
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Elige una fecha</h2>
                <p className="text-slate-500 text-sm mb-6">Fechas disponibles en los próximos 30 días</p>
                {availableDates.length === 0 && <p className="text-slate-400 text-sm">No hay fechas disponibles en los próximos 30 días.</p>}
                <div className="grid grid-cols-3 gap-2">
                  {availableDates.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => { setSelectedDate(d); setStep(3); }}
                      className="p-3 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center group"
                    >
                      <p className="text-xs text-slate-400 capitalize group-hover:text-indigo-500">{DAYS[d.getDay()].slice(0, 3)}</p>
                      <p className="font-bold text-slate-900 text-lg leading-tight">{d.getDate()}</p>
                      <p className="text-xs text-slate-400 capitalize">{MONTHS[d.getMonth()].slice(0, 3)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Hora */}
            {step === 3 && (
              <div>
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Elige un horario</h2>
                <p className="text-slate-500 text-sm mb-6">Horarios disponibles para el día seleccionado</p>
                <div className="grid grid-cols-4 gap-2">
                  {slotsForDate.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setStep(4); }}
                      className="py-3 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Datos */}
            {step === 4 && (
              <div>
                <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Tus datos de contacto</h2>
                <p className="text-slate-500 text-sm mb-6">Para enviarte la confirmación de tu reserva</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Nombre completo *</label>
                    <input
                      required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className={inputClass}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Teléfono WhatsApp *</label>
                    <input
                      required value={form.client_phone}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className={inputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1">Recibirás la confirmación por WhatsApp</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Email <span className="font-normal text-slate-400">(opcional)</span></label>
                    <input
                      type="email" value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Notas adicionales</label>
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
                    disabled={submitting || !form.client_name || !form.client_phone}
                    className="w-full bg-indigo-600 text-white rounded-2xl py-3.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
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
