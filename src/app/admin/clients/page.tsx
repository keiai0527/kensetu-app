'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  day_rate: number;
  night_rate: number;
  trip_day_rate: number;
  trip_night_rate: number;
  closing_day: number;
  has_night_shift: boolean;
  has_trip: boolean;
  is_active: boolean;
  display_order: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', day_rate: '0', night_rate: '0', trip_day_rate: '0', trip_night_rate: '0',
    closing_day: '31', has_night_shift: false, has_trip: false, display_order: '0',
  });

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('display_order');
    if (data) setClients(data);
    setLoading(false);
  }

  function handleNew() {
    setEditId(null);
    setForm({ name: '', day_rate: '0', night_rate: '0', trip_day_rate: '0', trip_night_rate: '0', closing_day: '31', has_night_shift: false, has_trip: false, display_order: '0' });
    setShowForm(true);
  }

  function handleEdit(c: Client) {
    setEditId(c.id);
    setForm({
      name: c.name, day_rate: String(c.day_rate), night_rate: String(c.night_rate),
      trip_day_rate: String(c.trip_day_rate), trip_night_rate: String(c.trip_night_rate),
      closing_day: String(c.closing_day), has_night_shift: c.has_night_shift, has_trip: c.has_trip,
      display_order: String(c.display_order),
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      day_rate: parseInt(form.day_rate), night_rate: parseInt(form.night_rate),
      trip_day_rate: parseInt(form.trip_day_rate), trip_night_rate: parseInt(form.trip_night_rate),
      closing_day: parseInt(form.closing_day), has_night_shift: form.has_night_shift,
      has_trip: form.has_trip, display_order: parseInt(form.display_order),
    };
    if (editId) {
      await supabase.from('clients').update(payload).eq('id', editId);
    } else {
      await supabase.from('clients').insert(payload);
    }
    setShowForm(false);
    fetchClients();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">取引先マスター</h1>
          <button onClick={handleNew} className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">+ 新規追加</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left font-bold">取引先名</th>
                  <th className="px-3 py-3 text-right font-bold">日勤単価</th>
                  <th className="px-3 py-3 text-right font-bold">夜勤単価</th>
                  <th className="px-3 py-3 text-right font-bold">出張日勤</th>
                  <th className="px-3 py-3 text-right font-bold">出張夜勤</th>
                  <th className="px-3 py-3 text-center font-bold">締め日</th>
                  <th className="px-3 py-3 text-center font-bold">夜勤</th>
                  <th className="px-3 py-3 text-center font-bold">出張</th>
                  <th className="px-3 py-3 text-center font-bold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map(c => (
                  <tr key={c.id} className={!c.is_active ? 'opacity-40' : ''}>
                    <td className="px-3 py-3 font-bold">{c.name}</td>
                    <td className="px-3 py-3 text-right">{c.day_rate.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{c.night_rate.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{c.trip_day_rate.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{c.trip_night_rate.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center">{c.closing_day === 31 ? '月末' : `${c.closing_day}日`}</td>
                    <td className="px-3 py-3 text-center">{c.has_night_shift ? '○' : '-'}</td>
                    <td className="px-3 py-3 text-center">{c.has_trip ? '○' : '-'}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-800 font-bold">編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editId ? '取引先を編集' : '取引先を追加'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-bold mb-1">取引先名 *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full p-3 border-2 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1">日勤単価</label>
                  <input type="number" value={form.day_rate} onChange={(e) => setForm({...form, day_rate: e.target.value})} className="w-full p-3 border-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">夜勤単価</label>
                  <input type="number" value={form.night_rate} onChange={(e) => setForm({...form, night_rate: e.target.value})} className="w-full p-3 border-2 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1">出張日勤単価</label>
                  <input type="number" value={form.trip_day_rate} onChange={(e) => setForm({...form, trip_day_rate: e.target.value})} className="w-full p-3 border-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">出張夜勤単価</label>
                  <input type="number" value={form.trip_night_rate} onChange={(e) => setForm({...form, trip_night_rate: e.target.value})} className="w-full p-3 border-2 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1">締め日</label>
                  <select value={form.closing_day} onChange={(e) => setForm({...form, closing_day: e.target.value})} className="w-full p-3 border-2 rounded-lg">
                    <option value="20">20日</option>
                    <option value="31">月末</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">表示順</label>
                  <input type="number" value={form.display_order} onChange={(e) => setForm({...form, display_order: e.target.value})} className="w-full p-3 border-2 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.has_night_shift} onChange={(e) => setForm({...form, has_night_shift: e.target.checked})} className="w-5 h-5" />
                  <span className="font-bold">夜勤あり</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.has_trip} onChange={(e) => setForm({...form, has_trip: e.target.checked})} className="w-5 h-5" />
                  <span className="font-bold">出張あり</span>
                </label>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border-2 rounded-lg font-bold hover:bg-gray-100">キャンセル</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">{editId ? '更新' : '追加'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
