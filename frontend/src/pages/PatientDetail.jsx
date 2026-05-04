import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({ notes: '', diagnosis: '', treatment: '', professional_id: '' });
  const [consultSaving, setConsultSaving] = useState(false);

  const [showRxModal, setShowRxModal] = useState(false);
  const [rxContent, setRxContent] = useState('');
  const [rxConsultId, setRxConsultId] = useState(null);
  const [rxSaving, setRxSaving] = useState(false);

  const [professionals, setProfessionals] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: h }, { data: profs }] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/patients/${id}/history`),
        api.get('/professionals'),
      ]);
      setPatient(p);
      setEditForm({
        name: p.name,
        birth_date: p.birth_date || '',
        phone: p.phone || '',
        email: p.email || '',
        allergies: p.allergies || '',
        background: p.background || '',
      });
      setHistory(h.consultations);
      setProfessionals(profs);
    } catch {
      navigate('/dashboard/pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/patients/${id}`, editForm);
      setEditing(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const saveConsult = async (e) => {
    e.preventDefault();
    setConsultSaving(true);
    try {
      await api.post('/consultations', {
        patient_id: parseInt(id),
        ...consultForm,
        professional_id: consultForm.professional_id || undefined,
      });
      setShowConsultModal(false);
      setConsultForm({ notes: '', diagnosis: '', treatment: '', professional_id: '' });
      loadData();
    } finally {
      setConsultSaving(false);
    }
  };

  const saveRx = async (e) => {
    e.preventDefault();
    const consultId = rxConsultId || (history[0]?.id);
    if (!consultId) return;
    setRxSaving(true);
    try {
      const { data } = await api.post('/prescriptions', { consultation_id: consultId, content: rxContent });
      setShowRxModal(false);
      setRxContent('');
      setRxConsultId(null);
      window.open(`/api/prescriptions/${data.id}/pdf`);
    } finally {
      setRxSaving(false);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!patient) return null;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/dashboard/pacientes')} className="text-sm text-slate-400 hover:text-slate-700 mb-6 flex items-center gap-1">
        ← Volver a pacientes
      </button>

      {/* Patient data card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500 font-mono">{patient.rut}</p>
          </div>
          <button onClick={() => setEditing(!editing)} className="text-sm text-indigo-600 hover:underline">
            {editing ? 'Cancelar' : 'Editar datos'}
          </button>
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400">Teléfono:</span> <span className="text-slate-700">{patient.phone || '—'}</span></div>
            <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{patient.email || '—'}</span></div>
            <div><span className="text-slate-400">Nacimiento:</span> <span className="text-slate-700">{patient.birth_date || '—'}</span></div>
            <div><span className="text-slate-400">Registrado:</span> <span className="text-slate-700">{new Date(patient.created_at).toLocaleDateString('es-CL')}</span></div>
            {patient.allergies && (
              <div className="col-span-2"><span className="text-slate-400">Alergias:</span> <span className="text-slate-700">{patient.allergies}</span></div>
            )}
            {patient.background && (
              <div className="col-span-2"><span className="text-slate-400">Antecedentes:</span> <span className="text-slate-700">{patient.background}</span></div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha nacimiento</label>
                <input type="date" value={editForm.birth_date} onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alergias</label>
              <textarea rows={2} value={editForm.allergies} onChange={e => setEditForm({ ...editForm, allergies: e.target.value })} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Antecedentes</label>
              <textarea rows={2} value={editForm.background} onChange={e => setEditForm({ ...editForm, background: e.target.value })} className={`${inputClass} resize-none`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consultation history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Historial de consultas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setRxConsultId(null); setRxContent(''); setShowRxModal(true); }}
              className="text-sm border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              Nueva receta
            </button>
            <button
              onClick={() => setShowConsultModal(true)}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-700"
            >
              + Nueva consulta
            </button>
          </div>
        </div>

        {history.length === 0 && <p className="text-slate-400 text-sm">No hay consultas registradas</p>}

        <div className="space-y-3">
          {history.map(c => (
            <div key={c.id} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">
                    {new Date(c.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {c.professional_name ? ` · ${c.professional_name}` : ''}
                  </p>
                  {c.diagnosis && (
                    <p className="text-sm text-slate-700"><span className="font-medium">Diagnóstico:</span> {c.diagnosis}</p>
                  )}
                  {c.treatment && (
                    <p className="text-sm text-slate-500 mt-1"><span className="font-medium">Tratamiento:</span> {c.treatment}</p>
                  )}
                </div>
                <button
                  onClick={() => { setRxConsultId(c.id); setRxContent(''); setShowRxModal(true); }}
                  className="text-xs text-indigo-600 hover:underline shrink-0"
                >
                  Receta
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New consultation modal */}
      {showConsultModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nueva consulta</h2>
            <form onSubmit={saveConsult} className="space-y-3">
              {professionals.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Profesional</label>
                  <select value={consultForm.professional_id} onChange={e => setConsultForm({ ...consultForm, professional_id: e.target.value })} className={inputClass}>
                    <option value="">Sin profesional</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas clínicas</label>
                <textarea rows={3} value={consultForm.notes} onChange={e => setConsultForm({ ...consultForm, notes: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnóstico</label>
                <textarea rows={2} value={consultForm.diagnosis} onChange={e => setConsultForm({ ...consultForm, diagnosis: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tratamiento / indicaciones</label>
                <textarea rows={2} value={consultForm.treatment} onChange={e => setConsultForm({ ...consultForm, treatment: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConsultModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={consultSaving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {consultSaving ? 'Guardando...' : 'Guardar consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New prescription modal */}
      {showRxModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Nueva receta</h2>
            {history.length === 0 && (
              <p className="text-amber-600 text-xs mb-3">Debes tener al menos una consulta para emitir una receta.</p>
            )}
            {!rxConsultId && history.length > 0 && (
              <p className="text-slate-500 text-xs mb-3">Se asociará a la consulta más reciente.</p>
            )}
            <form onSubmit={saveRx} className="space-y-3">
              <textarea
                required rows={6}
                value={rxContent} onChange={e => setRxContent(e.target.value)}
                placeholder="Medicamentos, indicaciones, dosis..."
                className={`${inputClass} resize-none`}
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRxModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button
                  type="submit"
                  disabled={rxSaving || history.length === 0}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {rxSaving ? 'Guardando...' : 'Guardar y descargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
