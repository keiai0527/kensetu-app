'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  honorific_name: string | null;
  address: string | null;
  day_rate: number;
  overtime_rate: number;
  billing_day_start: number;
  billing_day_end: number;
  is_active: boolean;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    honorific_name: '',
    address: '',
    day_rate: '16000',
    overtime_rate: '2300',
    billing_day_start: '21',
    billing_day_end: '20',
  });

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (data) setClients(data);
    setLoading(false);
  }

  function handleNew() {
    setEditId(null);
    setForm({
      name: '', honorific_name: '', address: '',
      day_rate: '16000', overtime_rate: '2300',
      billing_day_start: '21', billing_day_end: '20',
    });
    setShowForm(true);
  }

  function handleEdit(c: Client) {
    setEditId(c.id);
    setForm({
      name: c.name || '',
      honorific_name: c.honorific_name || '',
      address: c.address || '',
      day_rate: String(c.day_rate),
      overtime_rate: String(c.overtime_rate),
      billing_day_start: String(c.billing_day_start),
      billing_day_end: String(c.billing_day_end),
    });
    setShowForm(true);
  }

  async function handleSave() {
    const payload = {
      name: form.name,
      honorific_name: form.honorific_name || form.name + ' 御中',
      address: form.address || null,
      day_rate: parseInt(form.day_rate) || 16000,
      overtime_rate: parseInt(form.overtime_rate) || 2300,
      billing_day_start: parseInt(form.billing_day_start) || 21,
      billing_day_end: parseInt(form.billing_day_end) || 20,
      is_active: true,
    };

    if (editId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editId);
      if (error) { alert('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + error.message); return; }
      alert('\u53d6\u5f15\u5148\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f');
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) { alert('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + error.message); return; }
      alert('\u53d6\u5f15\u5148\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f');
    }
    setShowForm(false);
    fetchClients();
  }

  async function handleToggleActive(c: Client) {
    const newStatus = !c.is_active;
    const msg = newStatus ? '\u6709\u52b9\u306b\u3057\u307e\u3059\u304b\uff1f' : '\u7121\u52b9\u306b\u3057\u307e\u3059\u304b\uff1f';
    if (!confirm(c.name + ' \u3092' + msg)) return;
    await supabase.from('clients').update({ is_active: newStatus }).eq('id', c.id);
    fetchClients();
  }

  function formatYen(n: number | undefined | null) {
    return '\u00a5' + (n ?? 0).toLocaleString();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">取引先マスター</h1>
          <a href="/admin" className="text-gray-300 hover:text-white text-sm">← 管理画面</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-500">
            {clients.filter(c => c.is_active).length} 社（有効）/ {clients.length} 社（全体）
          </div>
          <button
            onClick={handleNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
          >
            + 新規取引先
          </button>
        </div>

        {/* 取引先一覧 */}
        <div className="space-y-3">
          {clients.map(c => (
            <div
              key={c.id}
              className={`bg-white rounded-xl shadow p-4 ${!c.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-lg">{c.name}</div>
                  {c.address && <div className="text-sm text-gray-500 mt-1">{c.address}</div>}
                  <div className="flex gap-4 mt-2">
                    <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      日当 {formatYen(c.day_rate)}
                    </span>
                    <span className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      残業 {formatYen(c.overtime_rate)}/h
                    </span>
                    <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      締日 {c.billing_day_start}日〜{c.billing_day_end}日
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(c)}
                    className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleToggleActive(c)}
                    className={`text-sm px-2 py-1 ${c.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                  >
                    {c.is_active ? '無効化' : '有効化'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            取引先が登録されていません
          </div>
        )}

        {/* フォームモーダル */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b">
                <h2 className="text-lg font-bold">
                  {editId ? '取引先の編集' : '新規取引先'}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">会社名 *</label>
                  <input
                    type="text" value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="株式会社　カナヤマ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">請求書表示名</label>
                  <input
                    type="text" value={form.honorific_name}
                    onChange={e => setForm({...form, honorific_name: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="自動: 会社名 + 御中"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">住所</label>
                  <input
                    type="text" value={form.address}
                    onChange={e => setForm({...form, address: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="京都市南区..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">日当単価（円）</label>
                    <input
                      type="number" value={form.day_rate}
                      onChange={e => setForm({...form, day_rate: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">残業単価（円/h）</label>
                    <input
                      type="number" value={form.overtime_rate}
                      onChange={e => setForm({...form, overtime_rate: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">請求開始日</label>
                    <input
                      type="number" value={form.billing_day_start} min="1" max="28"
                      onChange={e => setForm({...form, billing_day_start: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">請求終了日</label>
                    <input
                      type="number" value={form.billing_day_end} min="1" max="28"
                      onChange={e => setForm({...form, billing_day_end: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
