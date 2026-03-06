'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type ClientSummary = {
  clientName: string;
  dayCount: number;
  nightCount: number;
  tripDayCount: number;
  tripNightCount: number;
  overtimeHours: number;
  dayRate: number;
  nightRate: number;
  tripDayRate: number;
  tripNightRate: number;
  totalRevenue: number;
};

type EmployeeSummary = {
  employeeName: string;
  workDays: number;
  dayCount: number;
  nightCount: number;
  overtimeHours: number;
};

export default function MonthlyPage() {
  const [month, setMonth] = useState('');
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);
    fetchSummary(m);
  }, []);

  async function fetchSummary(monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(name, daily_wage, night_wage), clients(name, day_rate, night_rate, trip_day_rate, trip_night_rate)')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('is_holiday', false);

    if (!attendance) { setLoading(false); return; }

    // 取引先別集計
    const clientMap = new Map<string, ClientSummary>();
    attendance.forEach((a: any) => {
      const cName = a.clients?.name || '不明';
      if (!clientMap.has(cName)) {
        clientMap.set(cName, {
          clientName: cName, dayCount: 0, nightCount: 0, tripDayCount: 0, tripNightCount: 0,
          overtimeHours: 0, dayRate: a.clients?.day_rate || 0, nightRate: a.clients?.night_rate || 0,
          tripDayRate: a.clients?.trip_day_rate || 0, tripNightRate: a.clients?.trip_night_rate || 0, totalRevenue: 0,
        });
      }
      const s = clientMap.get(cName)!;
      if (a.shift_type === 'day') s.dayCount++;
      else if (a.shift_type === 'night') s.nightCount++;
      else if (a.shift_type === 'trip_day') s.tripDayCount++;
      else if (a.shift_type === 'trip_night') s.tripNightCount++;
      s.overtimeHours += a.overtime_hours || 0;
    });

    clientMap.forEach(s => {
      s.totalRevenue = s.dayRate * s.dayCount + s.nightRate * s.nightCount
        + s.tripDayRate * s.tripDayCount + s.tripNightRate * s.tripNightCount
        + Math.round(s.dayRate / 8 * 1.25 * s.overtimeHours);
    });

    // 従業員別集計
    const empMap = new Map<string, EmployeeSummary>();
    attendance.forEach((a: any) => {
      const eName = a.employees?.name || '不明';
      if (!empMap.has(eName)) {
        empMap.set(eName, { employeeName: eName, workDays: 0, dayCount: 0, nightCount: 0, overtimeHours: 0 });
      }
      const s = empMap.get(eName)!;
      s.workDays++;
      if (a.shift_type === 'day' || a.shift_type === 'trip_day') s.dayCount++;
      else s.nightCount++;
      s.overtimeHours += a.overtime_hours || 0;
    });

    setClientSummaries(Array.from(clientMap.values()));
    setEmployeeSummaries(Array.from(empMap.values()));
    setLoading(false);
  }

  const totalRevenue = clientSummaries.reduce((sum, s) => sum + s.totalRevenue, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">月次集計</h1>
          <div></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-4">
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); fetchSummary(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg" />
          <div className="text-lg font-bold text-green-700">
            売上合計: {totalRevenue.toLocaleString()}円
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">集計中...</div>
        ) : (
          <>
            {/* 取引先別売上 */}
            <h2 className="text-lg font-bold mb-2 mt-6">取引先別売上</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold">取引先</th>
                    <th className="px-3 py-3 text-center font-bold">日勤</th>
                    <th className="px-3 py-3 text-center font-bold">夜勤</th>
                    <th className="px-3 py-3 text-center font-bold">出張</th>
                    <th className="px-3 py-3 text-center font-bold">残業h</th>
                    <th className="px-3 py-3 text-right font-bold">売上</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientSummaries.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-bold">{s.clientName}</td>
                      <td className="px-3 py-2 text-center">{s.dayCount}人工</td>
                      <td className="px-3 py-2 text-center">{s.nightCount > 0 ? `${s.nightCount}人工` : '-'}</td>
                      <td className="px-3 py-2 text-center">{(s.tripDayCount + s.tripNightCount) > 0 ? `${s.tripDayCount + s.tripNightCount}人工` : '-'}</td>
                      <td className="px-3 py-2 text-center">{s.overtimeHours > 0 ? s.overtimeHours : '-'}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{s.totalRevenue.toLocaleString()}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 従業員別出勤 */}
            <h2 className="text-lg font-bold mb-2">従業員別出勤数</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold">従業員</th>
                    <th className="px-3 py-3 text-center font-bold">出勤日数</th>
                    <th className="px-3 py-3 text-center font-bold">日勤</th>
                    <th className="px-3 py-3 text-center font-bold">夜勤</th>
                    <th className="px-3 py-3 text-center font-bold">残業h</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employeeSummaries.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-bold">{s.employeeName}</td>
                      <td className="px-3 py-2 text-center">{s.workDays}日</td>
                      <td className="px-3 py-2 text-center">{s.dayCount}</td>
                      <td className="px-3 py-2 text-center">{s.nightCount > 0 ? s.nightCount : '-'}</td>
                      <td className="px-3 py-2 text-center">{s.overtimeHours > 0 ? s.overtimeHours : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
