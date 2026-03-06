'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PayrollItem = {
  employeeId: string;
  employeeName: string;
  workDays: number;
  dayCount: number;
  nightCount: number;
  overtimeHours: number;
  dailyWage: number;
  nightWage: number;
  overtimeHourly: number;
  basePay: number;
  nightPay: number;
  overtimePay: number;
  allowance: number;
  deduction: number;
  deductionNote: string;
  finalPay: number;
};

export default function PayrollPage() {
  const [month, setMonth] = useState('');
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);
    fetchPayroll(m);
  }, []);

  async function fetchPayroll(monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(id, name, daily_wage, night_wage, overtime_hourly)')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('is_holiday', false);

    if (!attendance) { setLoading(false); return; }

    const empMap = new Map<string, PayrollItem>();
    attendance.forEach((a: any) => {
      const emp = a.employees;
      if (!emp) return;
      if (!empMap.has(emp.id)) {
        empMap.set(emp.id, {
          employeeId: emp.id, employeeName: emp.name,
          workDays: 0, dayCount: 0, nightCount: 0, overtimeHours: 0,
          dailyWage: emp.daily_wage, nightWage: emp.night_wage, overtimeHourly: emp.overtime_hourly,
          basePay: 0, nightPay: 0, overtimePay: 0,
          allowance: 0, deduction: 0, deductionNote: '', finalPay: 0,
        });
      }
      const item = empMap.get(emp.id)!;
      item.workDays++;
      if (a.shift_type === 'day' || a.shift_type === 'trip_day') item.dayCount++;
      else item.nightCount++;
      item.overtimeHours += a.overtime_hours || 0;
    });

    // çµ¦ä¸è¨ç®
    empMap.forEach(item => {
      item.basePay = item.dailyWage * item.dayCount;
      item.nightPay = item.nightWage * item.nightCount;
      if (item.nightPay < 0) item.nightPay = 0;
      item.overtimePay = item.overtimeHourly * item.overtimeHours;
      item.finalPay = item.basePay + item.nightPay + item.overtimePay + item.allowance - item.deduction;
    });

    setItems(Array.from(empMap.values()));
    setLoading(false);
  }

  function updateItem(index: number, field: string, value: number | string) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    // åè¨ç®
    const item = newItems[index];
    item.finalPay = item.basePay + item.nightPay + item.overtimePay + item.allowance - item.deduction;
    setItems(newItems);
  }

  const totalPay = items.reduce((sum, i) => sum + i.finalPay, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; ç®¡çç»é¢</a>
          <h1 className="text-lg font-bold">çµ¦ä¸è¨ç®</h1>
          <div></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-4">
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); fetchPayroll(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg" />
          <div className="text-lg font-bold text-red-700">
            çµ¦ä¸åè¨: {totalPay.toLocaleString()}å
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">è¨ç®ä¸­...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">ãã®æã®åºå¤ãã¼ã¿ãããã¾ãã</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left font-bold">å¾æ¥­å¡</th>
                  <th className="px-2 py-3 text-center font-bold">åºå¤</th>
                  <th className="px-2 py-3 text-center font-bold">æ¥å¤</th>
                  <th className="px-2 py-3 text-center font-bold">å¤å¤</th>
                  <th className="px-2 py-3 text-center font-bold">æ®æ¥­h</th>
                  <th className="px-2 py-3 text-right font-bold">åºæ¬çµ¦</th>
                  <th className="px-2 py-3 text-right font-bold">å¤å¤æ¥çµ¦</th>
                  <th className="px-2 py-3 text-right font-bold">æ®æ¥­æå½</th>
                  <th className="px-2 py-3 text-right font-bold">æå½</th>
                  <th className="px-2 py-3 text-right font-bold">æ§é¤</th>
                  <th className="px-2 py-3 text-right font-bold">æ¯çµ¦é¡</th>
                  <th className="px-2 py-3 text-center font-bold">æä½</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={item.employeeId}>
                    <td className="px-2 py-2 font-bold">{item.employeeName}</td>
                    <td className="px-2 py-2 text-center">{item.workDays}æ¥</td>
                    <td className="px-2 py-2 text-center">{item.dayCount}</td>
                    <td className="px-2 py-2 text-center">{item.nightCount > 0 ? item.nightCount : '-'}</td>
                    <td className="px-2 py-2 text-center">{item.overtimeHours > 0 ? item.overtimeHours : '-'}</td>
                    <td className="px-2 py-2 text-right">{item.basePay.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{item.nightPay > 0 ? item.nightPay.toLocaleString() : '-'}</td>
                    <td className="px-2 py-2 text-right">{item.overtimePay > 0 ? item.overtimePay.toLocaleString() : '-'}</td>
                    <td className="px-2 py-2 text-right">
                      {editIndex === i ? (
                        <input type="number" value={item.allowance} onChange={(e) => updateItem(i, 'allowance', parseInt(e.target.value) || 0)}
                          className="w-20 p-1 border rounded text-right text-sm" />
                      ) : (
                        item.allowance > 0 ? item.allowance.toLocaleString() : '-'
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editIndex === i ? (
                        <input type="number" value={item.deduction} onChange={(e) => updateItem(i, 'deduction', parseInt(e.target.value) || 0)}
                          className="w-20 p-1 border rounded text-right text-sm" />
                      ) : (
                        item.deduction > 0 ? <span className="text-red-600">-{item.deduction.toLocaleString()}</span> : '-'
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-blue-700">{item.finalPay.toLocaleString()}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => setEditIndex(editIndex === i ? null : i)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                      >
                        {editIndex === i ? 'å®äº' : 'ä¿®æ­£'}
                      </button>
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
