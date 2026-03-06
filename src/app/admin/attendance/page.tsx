'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Record = {
  id: string;
  date: string;
  site_name: string;
  shift_type: string;
  has_overtime: boolean;
  overtime_hours: number;
  is_holiday: boolean;
  note: string;
  employees: { name: string } | null;
  clients: { name: string } | null;
};

const SHIFT_LABELS: { [key: string]: string } = {
  day: '日勤', night: '夜勤', trip_day: '出張日勤', trip_night: '出張夜勤',
};

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);
    fetchRecords(m);
  }, []);

  async function fetchRecords(monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data } = await supabase
      .from('attendance')
      .select('*, employees(name), clients(name)')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });

    if (data) setRecords(data as Record[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return;
    await supabase.from('attendance').delete().eq('id', id);
    fetchRecords(month);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">出勤記録一覧</h1>
          <div></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); fetchRecords(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg"
          />
          <span className="ml-4 text-gray-600">件数: <strong>{records.length}</strong></span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left font-bold">日付</th>
                  <th className="px-3 py-3 text-left font-bold">従業員</th>
                  <th className="px-3 py-3 text-left font-bold">取引先</th>
                  <th className="px-3 py-3 text-left font-bold">現場</th>
                  <th className="px-3 py-3 text-center font-bold">勤務</th>
                  <th className="px-3 py-3 text-center font-bold">残業</th>
                  <th className="px-3 py-3 text-center font-bold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className={r.is_holiday ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 font-bold">{r.employees?.name}</td>
                    <td className="px-3 py-2">{r.is_holiday ? '-' : r.clients?.name}</td>
                    <td className="px-3 py-2 text-xs">{r.site_name || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.is_holiday ? <span className="text-gray-400">休み</span> : SHIFT_LABELS[r.shift_type]}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.has_overtime ? `${r.overtime_hours}h` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
