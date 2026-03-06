'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type AttendanceRecord = {
  id: string;
  date: string;
  site_name: string;
  shift_type: string;
  has_overtime: boolean;
  overtime_hours: number;
  is_holiday: boolean;
  note: string;
  clients: { name: string } | null;
};

const SHIFT_LABELS: Record<string, string> = {
  day: '日勤',
  night: '夜勤',
  trip_day: '出張日勤',
  trip_night: '出張夜勤',
};

const SHIFT_LABELS_VI: Record<string, string> = {
  day: 'Ca ngày',
  night: 'Ca đêm',
  trip_day: 'Công tác ngày',
  trip_night: 'Công tác đêm',
};

export default function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');

  useEffect(() => {
    const id = sessionStorage.getItem('employee_id');
    const name = sessionStorage.getItem('employee_name');
    if (!id || !name) {
      window.location.href = '/';
      return;
    }
    setEmployeeId(id);
    setEmployeeName(name);

    // 今月をデフォルト
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);

    fetchRecords(id, m);
  }, []);

  async function fetchRecords(empId: string, monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data } = await supabase
      .from('attendance')
      .select('id, date, site_name, shift_type, has_overtime, overtime_hours, is_holiday, note, clients(name)')
      .eq('employee_id', empId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });

    if (data) setRecords(data as AttendanceRecord[]);
    setLoading(false);
  }

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchRecords(employeeId, m);
  }

  const workDays = records.filter(r => !r.is_holiday).length;
  const holidays = records.filter(r => r.is_holiday).length;

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-blue-800 text-white p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <a href="/" className="text-blue-200 hover:text-white">&larr; 戻る</a>
          <h1 className="text-lg font-bold">入力履歴</h1>
          <span className="text-blue-200 text-sm">{employeeName}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {/* 月選択 */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <input
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-4 mt-3 text-sm text-gray-600">
            <span>出勤: <strong className="text-blue-700">{workDays}日</strong></span>
            <span>休み: <strong className="text-gray-500">{holidays}日</strong></span>
          </div>
        </div>

        {/* 記録一覧 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            この月の記録はありません<br/>
            <span className="text-sm">Không có dữ liệu trong tháng này</span>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <div
                key={record.id}
                className={`bg-white rounded-lg shadow p-4 ${
                  record.is_holiday ? 'border-l-4 border-gray-400' : 'border-l-4 border-blue-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-800">
                    {new Date(record.date + 'T00:00:00').toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </span>
                  {record.is_holiday ? (
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-bold">
                      休み
                    </span>
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      record.shift_type === 'night' || record.shift_type === 'trip_night'
                        ? 'bg-purple-100 text-purple-700'
                        : record.shift_type.startsWith('trip')
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {SHIFT_LABELS[record.shift_type]}
                    </span>
                  )}
                </div>
                {!record.is_holiday && (
                  <>
                    <div className="text-sm text-gray-600">
                      {record.clients?.name}
                      {record.site_name && ` - ${record.site_name}`}
                    </div>
                    {record.has_overtime && (
                      <div className="text-sm text-orange-600 font-bold mt-1">
                        残業 {record.overtime_hours}時間
                      </div>
                    )}
                  </>
                )}
                {record.note && (
                  <div className="text-xs text-gray-500 mt-1">{record.note}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/attendance" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold inline-block hover:bg-blue-700">
            出勤を入力する / Nhập chấm công
          </a>
        </div>
      </main>
    </div>
  );
}
