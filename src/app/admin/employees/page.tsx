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
  // 給与設定（新規）
  base_daily_wage: number;
  night_allowance_per_day: number;
  position_allowance: number;
  trip_allowance: number;
  special_allowance: number;
  // 固定控除設定（新規）
  rent_deduction: number;
  utilities_deduction: number;
  safety_association_fee: number;
  japanese_study_fee_enabled: boolean;
  japanese_study_fee_amount: number;
  wifi_deduction: number;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'salary' | 'deduction'>('basic');
  const [form, setForm] = useState({
    name: '',
    name_vi: '',
    daily_wage: '12000',
    night_wage: '15000',
    overtime_hourly: '1000',
    display_order: '0',
    // 給与設定
    base_daily_wage: '12000',
    night_allowance_per_day: '3000',
    position_allowance: '0',
    trip_allowance: '0',
    special_allowance: '0',
    // 固定控除
    rent_deduction: '0',
    utilities_deduction: '0',
    safety_association_fee: '1500',
    japanese_study_fee_enabled: false,
    japanese_study_fee_amount: '0',
    wifi_deduction: '0',
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
    setActiveTab('basic');
    setForm({
      name: '', name_vi: '',
      daily_wage: '12000', night_wage: '15000', overtime_hourly: '1000', display_order: '0',
      base_daily_wage: '12000', night_allowance_per_day: '3000',
      position_allowance: '0', trip_allowance: '0', special_allowance: '0',
      rent_deduction: '0', utilities_deduction: '0', safety_association_fee: '1500',
      japanese_study_fee_enabled: false, japanese_study_fee_amount: '0', wifi_deduction: '0',
    });
    setShowForm(true);
  }

  function handleEdit(emp: Employee) {
    setEditId(emp.id);
    setActiveTab('basic');
    setForm({
      name: emp.name,
      name_vi: emp.name_vi || '',
      daily_wage: String(emp.daily_wage),
      night_wage: String(emp.night_wage),
      overtime_hourly: String(emp.overtime_hourly),
      display_order: String(emp.display_order),
      base_daily_wage: String(emp.base_daily_wage || emp.daily_wage),
      night_allowance_per_day: String(emp.night_allowance_per_day ?? 3000),
      position_allowance: String(emp.position_allowance || 0),
      trip_allowance: String(emp.trip_allowance || 0),
      special_allowance: String(emp.special_allowance || 0),
      rent_deduction: String(emp.rent_deduction || 0),
      utilities_deduction: String(emp.utilities_deduction || 0),
      safety_association_fee: String(emp.safety_association_fee ?? 1500),
      japanese_study_fee_enabled: emp.japanese_study_fee_enabled || false,
      japanese_study_fee_amount: String(emp.japanese_study_fee_amount || 0),
      wifi_deduction: String(emp.wifi_deduction || 0),
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const baseDailyWage = parseInt(form.base_daily_wage) || 0;
    const payload = {
      name: form.name,
      name_vi: form.name_vi || null,
      daily_wage: baseDailyWage,
      night_wage: parseInt(form.night_wage) || 0,
      overtime_hourly: parseInt(form.overtime_hourly) || 0,
      display_order: parseInt(form.display_order) || 0,
      base_daily_wage: baseDailyWage,
      night_allowance_per_day: parseInt(form.night_allowance_per_day) || 3000,
      position_allowance: parseInt(form.position_allowance) || 0,
      trip_allowance: parseInt(form.trip_allowance) || 0,
      special_allowance: parseInt(form.special_allowance) || 0,
      rent_deduction: parseInt(form.rent_deduction) || 0,
      utilities_deduction: parseInt(form.utilities_deduction) || 0,
      safety_association_fee: parseInt(form.safety_association_fee) || 1500,
      japanese_study_fee_enabled: form.japanese_study_fee_enabled,
      japanese_study_fee_amount: parseInt(form.japanese_study_fee_amount) || 0,
      wifi_deduction: parseInt(form.wifi_deduction) || 0,
    };

    if (editId) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editId);
      if (error) { alert('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + error.message); return; }
      alert('\u5f93\u696d\u54e1\u60c5\u5831\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f');
    } else {
      const { error } = await supabase.from('employees').insert(payload);
      if (error) { alert('\u767b\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + error.message); return; }
      alert('\u65b0\u3057\u3044\u5f93\u696d\u54e1\u3092\u767b\u9332\u3057\u307e\u3057\u305f');
    }
    setShowForm(false);
    fetchEmployees();
  }

  async function toggleActive(emp: Employee) {
    const newState = !emp.is_active;
    const { error } = await supabase.from('employees').update({ is_active: newState }).eq('id', emp.id);
    if (error) { alert('\u5909\u66f4\u306b\u5931\u6557\u3057\u307e\u3057\u305f'); return; }
    alert(newState ? '\u5728\u7c4d\u306b\u5909\u66f4\u3057\u307e\u3057\u305f' : '\u4f11\u6b62\u306b\u5909\u66f4\u3057\u307e\u3057\u305f');
    fetchEmployees();
  }

  // 控除合計を計算して一覧に表示
  function calcTotalDeduction(emp: Employee): number {
    let total = (emp.rent_deduction || 0) + (emp.utilities_deduction || 0) + (emp.safety_association_fee ?? 1500);
    if (emp.japanese_study_fee_enabled) total += (emp.japanese_study_fee_amount || 0);
    total += (emp.wifi_deduction || 0);
    return total;
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
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">基本日給</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">固定控除計</th>
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
                    <td className="px-4 py-3 text-right">
                      {(emp.base_daily_wage || emp.daily_wage).toLocaleString()}円
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {calcTotalDeduction(emp) > 0 ? `-${calcTotalDeduction(emp).toLocaleString()}円` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(emp)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {emp.is_active ? '在籍' : '離職'}
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

      {/* 編集フォーム（タブ式） */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editId ? '従業員を編集' : '従業員を追加'}
            </h3>

            {/* タブ切替 */}
            <div className="flex border-b mb-4">
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                基本情報
              </button>
              <button
                onClick={() => setActiveTab('salary')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeTab === 'salary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                給与設定
              </button>
              <button
                onClick={() => setActiveTab('deduction')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeTab === 'deduction' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                固定控除
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">

              {/* === 基本情報タブ === */}
              {activeTab === 'basic' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">名前（日本語）*</label>
                    <input type="text" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">名前（ベトナム語）</label>
                    <input type="text" value={form.name_vi}
                      onChange={(e) => setForm({ ...form, name_vi: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">残業時給（円）</label>
                      <input type="number" value={form.overtime_hourly}
                        onChange={(e) => setForm({ ...form, overtime_hourly: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">表示順</label>
                      <input type="number" value={form.display_order}
                        onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                </>
              )}

              {/* === 給与設定タブ === */}
              {activeTab === 'salary' && (
                <>
                  <div className="bg-blue-50 p-3 rounded-lg mb-2">
                    <p className="text-xs text-blue-700">従業員の基本日給・各種手当を設定します。給与計算時に自動適用されます。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">基本日給（円）*</label>
                    <input type="number" value={form.base_daily_wage}
                      onChange={(e) => setForm({ ...form, base_daily_wage: e.target.value, daily_wage: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">夜勤加算額（円/日）</label>
                      <input type="number" value={form.night_allowance_per_day}
                        onChange={(e) => setForm({ ...form, night_allowance_per_day: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">夜勤日給（円）</label>
                      <input type="number" value={form.night_wage}
                        onChange={(e) => setForm({ ...form, night_wage: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">職勤手当</label>
                      <input type="number" value={form.position_allowance}
                        onChange={(e) => setForm({ ...form, position_allowance: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">出張手当</label>
                      <input type="number" value={form.trip_allowance}
                        onChange={(e) => setForm({ ...form, trip_allowance: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">特別手当</label>
                      <input type="number" value={form.special_allowance}
                        onChange={(e) => setForm({ ...form, special_allowance: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                </>
              )}

              {/* === 固定控除タブ === */}
              {activeTab === 'deduction' && (
                <>
                  <div className="bg-red-50 p-3 rounded-lg mb-2">
                    <p className="text-xs text-red-700">毎月の給与から自動控除される固定額を設定します。</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">家賃（円）</label>
                      <input type="number" value={form.rent_deduction}
                        onChange={(e) => setForm({ ...form, rent_deduction: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">光熱費（円）</label>
                      <input type="number" value={form.utilities_deduction}
                        onChange={(e) => setForm({ ...form, utilities_deduction: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">安全協力会費（円）</label>
                    <input type="number" value={form.safety_association_fee}
                      onChange={(e) => setForm({ ...form, safety_association_fee: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    <p className="text-xs text-gray-400 mt-1">※ デフォルト 1,500円</p>
                  </div>
                  <div className="border-2 border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-700">日本語学習費</label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, japanese_study_fee_enabled: !form.japanese_study_fee_enabled })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          form.japanese_study_fee_enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          form.japanese_study_fee_enabled? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                    {form.japanese_study_fee_enabled && (
                      <input type="number" value={form.japanese_study_fee_amount}
                        onChange={(e) => setForm({ ...form, japanese_study_fee_amount: e.target.value })}
                        placeholder="金額（円）"
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">WiFi（円）</label>
                    <input type="number" value={form.wifi_deduction}
                      onChange={(e) => setForm({ ...form, wifi_deduction: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                    <p className="text-xs text-gray-400 mt-1">※ 将来拡張用</p>
                  </div>
                </>
              )}

              {/* ボタン */}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100">
                  キャンセル
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
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
