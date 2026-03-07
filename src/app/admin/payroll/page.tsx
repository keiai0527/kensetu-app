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
  // 従業員設定から取得
  baseDailyWage: number;
  nightAllowancePerDay: number;
  nightWage: number;
  overtimeHourly: number;
  positionAllowance: number;
  tripAllowance: number;
  specialAllowance: number;
  // 固定控除（従業員設定から）
  rentDeduction: number;
  utilitiesDeduction: number;
  safetyFee: number;
  japaneseStudyFee: number;
  wifiDeduction: number;
  // 月次調整（payroll_adjustmentsから）
  advancePayment: number;
  fineAmount: number;
  fineReason: string;
  otherDeduction: number;
  adjustmentMemo: string;
  // 計算結果
  basicSalary: number;
  nightPay: number;
  overtimePay: number;
  totalAllowance: number;
  grossPay: number;
  fixedDeductions: number;
  variableDeductions: number;
  totalDeductions: number;
  netSalary: number;
};

export default function PayrollPage() {
  const [month, setMonth] = useState('');
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

    // 出勤データ取得（従業員の全カラム含む）
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(*)')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('is_holiday', false);

    // 月次調整データ取得
    const { data: adjustments } = await supabase
      .from('payroll_adjustments')
      .select('*')
      .eq('year_month', monthStr);

    if (!attendance) { setLoading(false); return; }

    const adjMap = new Map<string, any>();
    (adjustments || []).forEach((a: any) => adjMap.set(a.employee_id, a));

    const empMap = new Map<string, PayrollItem>();

    attendance.forEach((a: any) => {
      const emp = a.employees;
      if (!emp) return;

      if (!empMap.has(emp.id)) {
        const adj = adjMap.get(emp.id) || {};
        const rentDed = emp.rent_deduction || 0;
        const utilDed = emp.utilities_deduction || 0;
        const safetyFee = emp.safety_association_fee ?? 1500;
        const jpFee = emp.japanese_study_fee_enabled ? (emp.japanese_study_fee_amount || 0) : 0;
        const wifiDed = emp.wifi_deduction || 0;

        empMap.set(emp.id, {
          employeeId: emp.id,
          employeeName: emp.name,
          workDays: 0, dayCount: 0, nightCount: 0, overtimeHours: 0,
          baseDailyWage: emp.base_daily_wage || emp.daily_wage,
          nightAllowancePerDay: emp.night_allowance_per_day ?? 3000,
          nightWage: emp.night_wage,
          overtimeHourly: emp.overtime_hourly,
          positionAllowance: emp.position_allowance || 0,
          tripAllowance: emp.trip_allowance || 0,
          specialAllowance: emp.special_allowance || 0,
          rentDeduction: rentDed,
          utilitiesDeduction: utilDed,
          safetyFee: safetyFee,
          japaneseStudyFee: jpFee,
          wifiDeduction: wifiDed,
          advancePayment: adj.advance_payment || 0,
          fineAmount: adj.fine_amount || 0,
          fineReason: adj.fine_reason || '',
          otherDeduction: adj.other_deduction || 0,
          adjustmentMemo: adj.memo || '',
          basicSalary: 0, nightPay: 0, overtimePay: 0,
          totalAllowance: 0, grossPay: 0,
          fixedDeductions: 0, variableDeductions: 0, totalDeductions: 0, netSalary: 0,
        });
      }

      const item = empMap.get(emp.id)!;
      item.workDays++;
      if (a.shift_type === 'day' || a.shift_type === 'trip_day') item.dayCount++;
      else item.nightCount++;
      item.overtimeHours += a.overtime_hours || 0;
    });

    // 給与計算
    empMap.forEach(item => {
      item.basicSalary = item.baseDailyWage * item.dayCount;
      item.nightPay = item.nightAllowancePerDay * item.nightCount;
      item.overtimePay = item.overtimeHourly * item.overtimeHours;
      item.totalAllowance = item.positionAllowance + item.tripAllowance + item.specialAllowance;
      item.grossPay = item.basicSalary + item.nightPay + item.overtimePay + item.totalAllowance;

      item.fixedDeductions = item.rentDeduction + item.utilitiesDeduction + item.safetyFee + item.japaneseStudyFee + item.wifiDeduction;
      item.variableDeductions = item.advancePayment + item.fineAmount + item.otherDeduction;
      item.totalDeductions = item.fixedDeductions + item.variableDeductions;

      item.netSalary = item.grossPay - item.totalDeductions;
    });

    setItems(Array.from(empMap.values()));
    setLoading(false);
  }

  // 月次調整をSupabaseに保存
  async function saveAdjustment(item: PayrollItem) {
    await supabase.from('payroll_adjustments').upsert({
      employee_id: item.employeeId,
      year_month: month,
      advance_payment: item.advancePayment,
      fine_amount: item.fineAmount,
      fine_reason: item.fineReason,
      other_deduction: item.otherDeduction,
      memo: item.adjustmentMemo,
    }, { onConflict: 'employee_id,year_month' });
  }

  function updateItem(index: number, field: string, value: number | string) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    // 再計算
    const item = newItems[index];
    item.variableDeductions = item.advancePayment + item.fineAmount + item.otherDeduction;
    item.totalDeductions = item.fixedDeductions + item.variableDeductions;
    item.netSalary = item.grossPay - item.totalDeductions;
    setItems(newItems);
  }

  const totalGross = items.reduce((sum, i) => sum + i.grossPay, 0);
  const totalNet = items.reduce((sum, i) => sum + i.netSalary, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">給与計算</h1>
          <a href="/admin/payslip" className="bg-green-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700">
            給与明細へ
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-4 flex-wrap">
          <input type="month" value={month}
            onChange={(e) => { setMonth(e.target.value); fetchPayroll(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg" />
          <div className="text-lg font-bold text-blue-700">
            総支給: {totalGross.toLocaleString()}円
          </div>
          <div className="text-lg font-bold text-red-700">
            差引合計: {totalNet.toLocaleString()}円
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">計算中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">この月の出勤データがありません</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={item.employeeId} className="bg-white rounded-xl shadow overflow-hidden">
                {/* メイン行 */}
                <div
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                >
                  <div className="flex-1">
                    <span className="font-bold text-gray-800">{item.employeeName}</span>
                    <span className="text-xs text-gray-500 ml-2">{item.workDays}日出勤</span>
                  </div>
                  <div className="text-right space-x-4">
                    <span className="text-sm text-gray-600">支給: <span className="font-bold text-blue-700">{item.grossPay.toLocaleString()}</span></span>
                    <span className="text-sm text-gray-600">控除: <span className="font-bold text-red-600">-{item.totalDeductions.toLocaleString()}</span></span>
                    <span className="text-lg font-bold text-green-700">{item.netSalary.toLocaleString()}円</span>
                  </div>
                  <span className="ml-3 text-gray-400">{expandedIndex === i ? '▲' : '▼'}</span>
                </div>

                {/* 展開詳細 */}
                {expandedIndex === i && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4">
                      {/* 左: 支給明細 */}
                      <div>
                        <h4 className="text-sm font-bold text-blue-700 mb-2">【支給】</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>基本給（{item.baseDailyWage.toLocaleString()}×{item.dayCount}日）</span>
                            <span className="font-bold">{item.basicSalary.toLocaleString()}</span>
                          </div>
                          {item.nightCount > 0 && (
                            <div className="flex justify-between">
                              <span>夜勤手当（{item.nightAllowancePerDay.toLocaleString()}×{item.nightCount}日）</span>
                              <span className="font-bold">{item.nightPay.toLocaleString()}</span>
                            </div>
                          )}
                          {item.overtimePay > 0 && (
                            <div className="flex justify-between">
                              <span>残業（{item.overtimeHours}h）</span>
                              <span className="font-bold">{item.overtimePay.toLocaleString()}</span>
                            </div>
                          )}
                          {item.positionAllowance > 0 && (
                            <div className="flex justify-between"><span>職務手当</span><span className="font-bold">{item.positionAllowance.toLocaleString()}</span></div>
                          )}
                          {item.tripAllowance > 0 && (
                            <div className="flex justify-between"><span>出張手当</span><span className="font-bold">{item.tripAllowance.toLocaleString()}</span></div>
                          )}
                          {item.specialAllowance > 0 && (
                            <div className="flex justify-between"><span>特別手当</span><span className="font-bold">{item.specialAllowance.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-bold text-blue-700">
                            <span>支給合計</span><span>{item.grossPay.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* 右: 控除明細 */}
                      <div>
                        <h4 className="text-sm font-bold text-red-700 mb-2">【控除】</h4>
                        <div className="space-y-1 text-sm">
                          {item.rentDeduction > 0 && (
                            <div className="flex justify-between"><span>家賃</span><span>{item.rentDeduction.toLocaleString()}</span></div>
                          )}
                          {item.utilitiesDeduction > 0 && (
                            <div className="flex justify-between"><span>光熱費</span><span>{item.utilitiesDeduction.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between"><span>安全協力会費</span><span>{item.safetyFee.toLocaleString()}</span></div>
                          {item.japaneseStudyFee > 0 && (
                            <div className="flex justify-between"><span>日本語学習費</span><span>{item.japaneseStudyFee.toLocaleString()}</span></div>
                          )}
                          {item.wifiDeduction > 0 && (
                            <div className="flex justify-between"><span>WiFi</span><span>{item.wifiDeduction.toLocaleString()}</span></div>
                          )}
                          {item.advancePayment > 0 && (
                            <div className="flex justify-between text-orange-600"><span>前渡し</span><span>{item.advancePayment.toLocaleString()}</span></div>
                          )}
                          {item.fineAmount > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>罰金{item.fineReason ? `（${item.fineReason}）` : ''}</span>
                              <span>{item.fineAmount.toLocaleString()}</span>
                            </div>
                          )}
                          {item.otherDeduction > 0 && (
                            <div className="flex justify-between"><span>その他</span><span>{item.otherDeduction.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                            <span>控除合計</span><span>-{item.totalDeductions.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 月次調整入力 */}
                    <div className="mt-4 border-t pt-3">
                      <h4 className="text-sm font-bold text-gray-700 mb-2">月次調整（前渡し・罰金等）</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">前渡し（円）</label>
                          <input type="number" value={item.advancePayment}
                            onChange={(e) => updateItem(i, 'advancePayment', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">罰金（円）</label>
                          <input type="number" value={item.fineAmount}
                            onChange={(e) => updateItem(i, 'fineAmount', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">罰金理由</label>
                          <input type="text" value={item.fineReason}
                            onChange={(e) => updateItem(i, 'fineReason', e.target.value)}
                            placeholder="例：安全帯未着用"
                            className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">その他控除（円）</label>
                          <input type="number" value={item.otherDeduction}
                            onChange={(e) => updateItem(i, 'otherDeduction', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border rounded text-sm" />
                        </div>
                      </div>
                      <button
                        onClick={() => saveAdjustment(item)}
                        className="mt-2 bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold hover:bg-orange-600"
                      >
                        保存
                      </button>
                    </div>

                    {/* 差引支給額 */}
                    <div className="mt-3 bg-green-50 rounded-lg p-3 text-center">
                      <span className="text-sm text-gray-600">差引支給額：</span>
                      <span className="text-2xl font-bold text-green-700 ml-2">{item.netSalary.toLocaleString()}円</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
