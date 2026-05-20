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

type EmployeeLite = {
  id: string;
  name: string;
  name_vi: string | null;
};

type RateOverride = {
  id?: string;
  client_id: string;
  employee_id: string;
  day_rate: number | null;
  overtime_rate: number | null;
};

type RateFormRow = {
  employee_id: string;
  employee_name: string;
  employee_name_vi: string | null;
  day_rate: string;
  overtime_rate: string;
  existing_id?: string;
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

  // 個別単価モーダル用
  const [ratesClient, setRatesClient] = useState<Client | null>(null);
  const [rateRows, setRateRows] = useState<RateFormRow[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);

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
      if (error) { alert('保存に失敗しました: ' + error.message); return; }
      alert('取引先を更新しました');
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) { alert('保存に失敗しました: ' + error.message); return; }
      alert('取引先を追加しました');
    }
    setShowForm(false);
    fetchClients();
  }

  async function handleToggleActive(c: Client) {
    const newStatus = !c.is_active;
    const msg = newStatus ? '有効にしますか？' : '無効にしますか？';
    if (!confirm(c.name + ' を' + msg)) return;
    await supabase.from('clients').update({ is_active: newStatus }).eq('id', c.id);
    fetchClients();
  }

  // === 個別単価モーダル ===

  async function handleOpenRates(client: Client) {
    setRatesClient(client);
    setRatesLoading(true);
    setRateRows([]);

    const [empRes, rateRes] = await Promise.all([
      supabase.from('employees').select('id, name, name_vi').eq('is_active', true).order('display_order').order('name'),
      supabase.from('client_employee_rates').select('*').eq('client_id', client.id),
    ]);

    const employees: EmployeeLite[] = empRes.data || [];
    const existing: RateOverride[] = rateRes.data || [];
    const byEmp = new Map<string, RateOverride>();
    for (const r of existing) byEmp.set(r.employee_id, r);

    const rows: RateFormRow[] = employees.map(e => {
      const ex = byEmp.get(e.id);
      return {
        employee_id: e.id,
        employee_name: e.name,
        employee_name_vi: e.name_vi,
        day_rate: ex?.day_rate != null ? String(ex.day_rate) : '',
        overtime_rate: ex?.overtime_rate != null ? String(ex.overtime_rate) : '',
        existing_id: ex?.id,
      };
    });
    setRateRows(rows);
    setRatesLoading(false);
  }

  function handleCloseRates() {
    setRatesClient(null);
    setRateRows([]);
  }

  function updateRateRow(idx: number, field: 'day_rate' | 'overtime_rate', value: string) {
    setRateRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSaveRates() {
    if (!ratesClient) return;
    setRatesSaving(true);

    const upserts: { client_id: string; employee_id: string; day_rate: number | null; overtime_rate: number | null }[] = [];
    const deletes: string[] = [];

    for (const r of rateRows) {
      const day = r.day_rate.trim() === '' ? null : parseInt(r.day_rate);
      const ot = r.overtime_rate.trim() === '' ? null : parseInt(r.overtime_rate);
      const hasValue = day != null || ot != null;

      if (hasValue) {
        upserts.push({
          client_id: ratesClient.id,
          employee_id: r.employee_id,
          day_rate: day,
          overtime_rate: ot,
        });
      } else if (r.existing_id) {
        deletes.push(r.existing_id);
      }
    }

    try {
      if (deletes.length > 0) {
        const { error } = await supabase.from('client_employee_rates').delete().in('id', deletes);
        if (error) throw error;
      }
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('client_employee_rates')
          .upsert(upserts, { onConflict: 'client_id,employee_id' });
        if (error) throw error;
      }
      alert('個別単価を保存しました');
      handleCloseRates();
    } catch (e: any) {
      alert('保存に失敗しました: ' + (e.message || e));
    } finally {
      setRatesSaving(false);
    }
  }

  function formatYen(n: number | undefined | null) {
    return '¥' + (n ?? 0).toLocaleString();
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
                  <div className="flex gap-4 mt-2 flex-wrap">
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
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleOpenRates(c)}
                    className="text-purple-600 hover:text-purple-800 text-sm px-2 py-1 font-bold"
                  >
                    個別単価
                  </button>
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

        {/* 個別単価モーダル */}
        {ratesClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b">
                <h2 className="text-lg font-bold">
                  個別単価設定 — {ratesClient.name}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  空欄の場合は基本単価（日当 {formatYen(ratesClient.day_rate)} / 残業 {formatYen(ratesClient.overtime_rate)}/h）が適用されます。
                </p>
              </div>

              <div className="p-5">
                {ratesLoading ? (
                  <div className="text-center py-8 text-gray-500">読み込み中...</div>
                ) : rateRows.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    在籍中の従業員がいません
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">従業員</th>
                        <th className="px-3 py-2 text-right">
                          日当（円）
                          <div className="text-xs font-normal text-gray-400">基本 {formatYen(ratesClient.day_rate)}</div>
                        </th>
                        <th className="px-3 py-2 text-right">
                          残業（円/h）
                          <div className="text-xs font-normal text-gray-400">基本 {formatYen(ratesClient.overtime_rate)}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rateRows.map((row, idx) => (
                        <tr key={row.employee_id}>
                          <td className="px-3 py-2">
                            <div className="font-bold">{row.employee_name}</div>
                            {row.employee_name_vi && (
                              <div className="text-xs text-gray-500">{row.employee_name_vi}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.day_rate}
                              onChange={e => updateRateRow(idx, 'day_rate', e.target.value)}
                              placeholder={`基本 ${ratesClient.day_rate}`}
                              className="w-full border rounded-lg px-3 py-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.overtime_rate}
                              onChange={e => updateRateRow(idx, 'overtime_rate', e.target.value)}
                              placeholder={`基本 ${ratesClient.overtime_rate}`}
                              className="w-full border rounded-lg px-3 py-2 text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-5 border-t flex justify-end gap-3">
                <button
                  onClick={handleCloseRates}
                  disabled={ratesSaving}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveRates}
                  disabled={ratesSaving || ratesLoading}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
                >
                  {ratesSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
