'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Employee = {
  id: string;
  name: string;
  name_vi: string | null;
  daily_wage: number;
  night_wage: number;
  overtime_hourly: number;
  is_active: boolean;
  display_order: number;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    name_vi: '',
    daily_wage: '12000',
    night_wage: '15000',
    overtime_hourly: '1000',
    display_order: '0',
  });

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('display_order')
      .order('name');
    if (data) setEmployees(data);
    setLoading(false);
  }

  function handleNew() {
    setEditId(null);
    setForm({ name: '', name_vi: '', daily_wage: '12000', night_wage: '15000', overtime_hourly: '1000', display_order: '0' });
    setShowForm(true);
  }

  function handleEdit(emp: Employee) {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      name_vi: emp.name_vi || '',
      daily_wage: String(emp.daily_wage),
      night_wage: String(emp.night_wage),
      overtime_hourly: String(emp.overtime_hourly),
      display_order: String(emp.display_order),
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      name_vi: form.name_vi || null,
      daily_wage: parseInt(form.daily_wage),
      night_wage: parseInt(form.night_wage),
      overtime_hourly: parseInt(form.overtime_hourly),
      display_order: parseInt(form.display_order),
    };

    if (editId) {
      await supabase.from('employees').update(payload).eq('id', editId);
    } else {
      await supabase.from('employees').insert(payload);
    }

    setShowForm(false);
    fetchEmployees();
  }

  async function toggleActive(emp: Employee) {
    await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id);
    fetchEmployees();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">従業員マスター</h1>
          <button onClick={handleNew} className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
            + 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            従業員が登録されていません。<br/>「新規追加」ボタンから追加してください。
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">名前</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">日給</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">夜勤日給</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-600">状態</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map(emp => (
                  <tr key={emp.id} className={!emp.is_active ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-bold">{emp.name}</div>
                      {emp.name_vi && <div className="text-xs text-gray-500">{emp.name_vi}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{emp.daily_wage.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-right">{emp.night_wage.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(emp)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {emp.is_active ? '在籍' : '退職'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(emp)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editId ? '従業員を編集' : '従業員を追加'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">名前（日本語）*</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">名前（ベトナム語）</label>
                <input
                  type="text"
                  value={form.name_vi}
                  onChange={(e) => setForm({ ...form, name_vi: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">日給（円）</label>
                  <input
                    type="number"
                    value={form.daily_wage}
                    onChange={(e) => setForm({ ...form, daily_wage: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">夜勤日給（円）</label>
                  <input
                    type="number"
                    value={form.night_wage}
                    onChange={(e) => setForm({ ...form, night_wage: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">残業時給（円）</label>
                  <input
                    type="number"
                    value={form.overtime_hourly}
                    onChange={(e) => setForm({ ...form, overtime_hourly: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">表示順</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                  {editId ? '更新' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
