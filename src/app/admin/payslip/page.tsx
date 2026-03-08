'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PayslipData = {
  employeeId: string;
  employeeName: string;
  employeeNameVi: string;
  yearMonth: string;
  workDays: number;
  dayCount: number;
  nightCount: number;
  overtimeHours: number;
  baseDailyWage: number;
  nightAllowancePerDay: number;
  overtimeHourly: number;
  basicSalary: number;
  nightPay: number;
  overtimePay: number;
  positionAllowance: number;
  tripAllowance: number;
  specialAllowance: number;
  grossPay: number;
  rentDeduction: number;
  utilitiesDeduction: number;
  safetyFee: number;
  japaneseStudyFee: number;
  wifiDeduction: number;
  advancePayment: number;
  fineAmount: number;
  fineReason: string;
  otherDeduction: number;
  totalDeductions: number;
  netSalary: number;
};

export default function PayslipPage() {
  const [month, setMonth] = useState('');
  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);
    fetchPayslips(m);
  }, []);

  async function fetchPayslips(monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(*)')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('is_holiday', false);

    const { data: adjustments } = await supabase
      .from('payroll_adjustments')
      .select('*')
      .eq('year_month', monthStr);

    if (!attendance) { setLoading(false); return; }

    const adjMap = new Map<string, any>();
    (adjustments || []).forEach((a: any) => adjMap.set(a.employee_id, a));

    const empMap = new Map<string, PayslipData>();

    attendance.forEach((a: any) => {
      const emp = a.employees;
      if (!emp) return;

      if (!empMap.has(emp.id)) {
        const adj = adjMap.get(emp.id) || {};
        empMap.set(emp.id, {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeNameVi: emp.name_vi || '',
          yearMonth: monthStr,
          workDays: 0, dayCount: 0, nightCount: 0, overtimeHours: 0,
          baseDailyWage: emp.base_daily_wage || emp.daily_wage,
          nightAllowancePerDay: emp.night_allowance_per_day ?? 3000,
          overtimeHourly: emp.overtime_hourly,
          basicSalary: 0, nightPay: 0, overtimePay: 0,
          positionAllowance: emp.position_allowance || 0,
          tripAllowance: emp.trip_allowance || 0,
          specialAllowance: emp.special_allowance || 0,
          grossPay: 0,
          rentDeduction: emp.rent_deduction || 0,
          utilitiesDeduction: emp.utilities_deduction || 0,
          safetyFee: emp.safety_association_fee ?? 1500,
          japaneseStudyFee: emp.japanese_study_fee_enabled ? (emp.japanese_study_fee_amount || 0) : 0,
          wifiDeduction: emp.wifi_deduction || 0,
          advancePayment: adj.advance_payment || 0,
          fineAmount: adj.fine_amount || 0,
          fineReason: adj.fine_reason || '',
          otherDeduction: adj.other_deduction || 0,
          totalDeductions: 0, netSalary: 0,
        });
      }

      const item = empMap.get(emp.id)!;
      item.workDays++;
      if (a.shift_type === 'day' || a.shift_type === 'trip_day') item.dayCount++;
      else item.nightCount++;
      item.overtimeHours += a.overtime_hours || 0;
    });

    empMap.forEach(item => {
      item.basicSalary = item.baseDailyWage * item.dayCount;
      item.nightPay = item.nightAllowancePerDay * item.nightCount;
      item.overtimePay = item.overtimeHourly * item.overtimeHours;
      item.grossPay = item.basicSalary + item.nightPay + item.overtimePay
        + item.positionAllowance + item.tripAllowance + item.specialAllowance;

      const fixedDed = item.rentDeduction + item.utilitiesDeduction + item.safetyFee + item.japaneseStudyFee + item.wifiDeduction;
      const varDed = item.advancePayment + item.fineAmount + item.otherDeduction;
      item.totalDeductions = fixedDed + varDed;
      item.netSalary = item.grossPay - item.totalDeductions;
    });

    setPayslips(Array.from(empMap.values()));
    setLoading(false);
  }

  function printPayslip(p: PayslipData) {
    const [y, m] = p.yearMonth.split('-');
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>給与明細 ${p.employeeName} ${y}年${m}月</title>
<style>
  body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; max-width: 600px; margin: 40px auto; font-size: 14px; }
  h1 { text-align: center; font-size: 20px; border-bottom: 3px double #333; padding-bottom: 10px; }
  .info { display: flex; justify-content: space-between; margin: 15px 0; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #333; padding: 6px 10px; }
  th { background: #f0f0f0; text-align: left; width: 45%; }
  td { text-align: right; }
  .section-title { background: #333; color: #fff; text-align: center; font-weight: bold; }
  .total-row th, .total-row td { background: #fff8e1; font-weight: bold; font-size: 15px; }
  .net-row th, .net-row td { background: #e8f5e9; font-weight: bold; font-size: 18px; }
  @media print { body { margin: 20px; } .no-print { display: none !important; } }
</style></head><body>
<h1>給 与 明 細 書</h1>
<div class="info">
  <div><strong>${p.employeeName}</strong>${p.employeeNameVi ? ` (${p.employeeNameVi})` : ''} 様</div>
  <div>${y}年${parseInt(m)}月分</div>
</div>
<div style="text-align:right;font-size:12px;color:#666;">出勤日数: ${p.workDays}日（日勤${p.dayCount} / 夜勤${p.nightCount}）${p.overtimeHours > 0 ? ` / 残業${p.overtimeHours}h` : ''}</div>

<table>
  <tr class="section-title"><td colspan="2">【支給】</td></tr>
  <tr><th>基本給（${p.baseDailyWage.toLocaleString()}円 × ${p.dayCount}日）</th><td>${p.basicSalary.toLocaleString()}</td></tr>
  ${p.nightCount > 0 ? `<tr><th>夜勤手当（${p.nightAllowancePerDay.toLocaleString()}円 × ${p.nightCount}日）</th><td>${p.nightPay.toLocaleString()}</td></tr>` : ''}
  ${p.overtimePay > 0 ? `<tr><th>残業手当（${p.overtimeHours}h）</th><td>${p.overtimePay.toLocaleString()}</td></tr>` : ''}
  ${p.positionAllowance > 0 ? `<tr><th>職務手当</th><td>${p.positionAllowance.toLocaleString()}</td></tr>` : ''}
  ${p.tripAllowance > 0 ? `<tr><th>出張手当</th><td>${p.tripAllowance.toLocaleString()}</td></tr>` : ''}
  ${p.specialAllowance > 0 ? `<tr><th>特別手当</th><td>${p.specialAllowance.toLocaleString()}</td></tr>` : ''}
  <tr class="total-row"><th>支給合計</th><td>${p.grossPay.toLocaleString()}</td></tr>
</table>

<table>
  <tr class="section-title"><td colspan="2">【控除】</td></tr>
  ${p.rentDeduction > 0 ? `<tr><th>家賃</th><td>${p.rentDeduction.toLocaleString()}</td></tr>` : ''}
  ${p.utilitiesDeduction > 0 ? `<tr><th>光熱費</th><td>${p.utilitiesDeduction.toLocaleString()}</td></tr>` : ''}
  <tr><th>安全協力会費</th><td>${p.safetyFee.toLocaleString()}</td></tr>
  ${p.japaneseStudyFee > 0 ? `<tr><th>日本語学習費</th><td>${p.japaneseStudyFee.toLocaleString()}</td></tr>` : ''}
  ${p.wifiDeduction > 0 ? `<tr><th>WiFi</th><td>${p.wifiDeduction.toLocaleString()}</td></tr>` : ''}
  ${p.advancePayment > 0 ? `<tr><th>前渡し</th><td>${p.advancePayment.toLocaleString()}</td></tr>` : ''}
  ${p.fineAmount > 0 ? `<tr><th>罰金${p.fineReason ? `（${p.fineReason}）` : ''}</th><td>${p.fineAmount.toLocaleString()}</td></tr>` : ''}
  ${p.otherDeduction > 0 ? `<tr><th>その他控除</th><td>${p.otherDeduction.toLocaleString()}</td></tr>` : ''}
  <tr class="total-row"><th>控除合計</th><td>-${p.totalDeductions.toLocaleString()}</td></tr>
</table>

<table>
  <tr class="net-row"><th>差引支給額</th><td>${p.netSalary.toLocaleString()}円</td></tr>
</table>

<div style="text-align:center;margin-top:30px;font-size:11px;color:#999;">
  株式会社敬愛興業 ｜ Cham勤怠管理システム
</div>
<div class="no-print" style="text-align:center;margin:30px 0;">
  <button onclick="window.print()" style="padding:10px 30px;font-size:16px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;margin:0 10px;">印刷 / PDF保存</button>
  <button onclick="window.close()" style="padding:10px 30px;font-size:16px;background:#666;color:#fff;border:none;border-radius:6px;cursor:pointer;margin:0 10px;">閉じる</button>
</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const selected = payslips.find(p => p.employeeId === selectedEmp);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; 管理画面</a>
          <h1 className="text-lg font-bold">給与明細</h1>
          <a href="/admin/payroll" className="text-gray-300 hover:text-white text-sm">給与計算へ</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-4 flex-wrap">
          <input type="month" value={month}
            onChange={(e) => { setMonth(e.target.value); setSelectedEmp(null); fetchPayslips(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg" />
          <span className="text-sm text-gray-500">{payslips.length}名</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : payslips.length === 0 ? (
          <div className="text-center py-8 text-gray-500">この月の出勤データがありません</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 左: 従業員リスト */}
            <div className="md:col-span-1 space-y-2">
              {payslips.map(p => (
                <button key={p.employeeId}
                  onClick={() => setSelectedEmp(p.employeeId)}
                  className={`w-full text-left p-3 rounded-xl shadow transition ${
                    selectedEmp === p.employeeId ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold">{p.employeeName}</div>
                  <div className={`text-sm ${selectedEmp === p.employeeId ? 'text-blue-100' : 'text-gray-500'}`}>
                    支給: {p.netSalary.toLocaleString()}円
                  </div>
                </button>
              ))}
            </div>

            {/* 右: 明細表示 */}
            <div className="md:col-span-2">
              {selected ? (
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selected.employeeName}</h2>
                      {selected.employeeNameVi && <p className="text-sm text-gray-500">{selected.employeeNameVi}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{month.replace('-', '年')}月分</p>
                      <p className="text-xs text-gray-400">出勤{selected.workDays}日</p>
                    </div>
                  </div>

                  {/* 支給 */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-blue-700 border-b border-blue-200 pb-1 mb-2">【支給】</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>基本給（{selected.baseDailyWage.toLocaleString()}×{selected.dayCount}日）</span>
                        <span>{selected.basicSalary.toLocaleString()}</span>
                      </div>
                      {selected.nightCount > 0 && (
                        <div className="flex justify-between">
                          <span>夜勤手当（{selected.nightAllowancePerDay.toLocaleString()}×{selected.nightCount}日）</span>
                          <span>{selected.nightPay.toLocaleString()}</span>
                        </div>
                      )}
                      {selected.overtimePay > 0 && (
                        <div className="flex justify-between"><span>残業手当</span><span>{selected.overtimePay.toLocaleString()}</span></div>
                      )}
                      {selected.positionAllowance > 0 && (
                        <div className="flex justify-between"><span>職務手当</span><span>{selected.positionAllowance.toLocaleString()}</span></div>
                      )}
                      {selected.tripAllowance > 0 && (
                        <div className="flex justify-between"><span>出張手当</span><span>{selected.tripAllowance.toLocaleString()}</span></div>
                      )}
                      {selected.specialAllowance > 0 && (
                        <div className="flex justify-between"><span>特別手当</span><span>{selected.specialAllowance.toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between border-t pt-1 font-bold text-blue-700">
                        <span>支給合計</span><span>{selected.grossPay.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 控除 */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-red-700 border-b border-red-200 pb-1 mb-2">【控除】</h3>
                    <div className="space-y-1 text-sm">
                      {selected.rentDeduction > 0 && (
                        <div className="flex justify-between"><span>家賃</span><span>{selected.rentDeduction.toLocaleString()}</span></div>
                      )}
                      {selected.utilitiesDeduction > 0 && (
                        <div className="flex justify-between"><span>光熱費</span><span>{selected.utilitiesDeduction.toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between"><span>安全協力会費</span><span>{selected.safetyFee.toLocaleString()}</span></div>
                      {selected.japaneseStudyFee > 0 && (
                        <div className="flex justify-between"><span>日本語学習費</span><span>{selected.japaneseStudyFee.toLocaleString()}</span></div>
                      )}
                      {selected.wifiDeduction > 0 && (
                        <div className="flex justify-between"><span>WiFi</span><span>{selected.wifiDeduction.toLocaleString()}</span></div>
                      )}
                      {selected.advancePayment > 0 && (
                        <div className="flex justify-between text-orange-600"><span>前渡し</span><span>{selected.advancePayment.toLocaleString()}</span></div>
                      )}
                      {selected.fineAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>罰金{selected.fineReason ? `（${selected.fineReason}}）` : ''}</span>
                          <span>{selected.fineAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {selected.otherDeduction > 0 && (
                        <div className="flex justify-between"><span>その他</span><span>{selected.otherDeduction.toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                        <span>控除合計</span><span>-{selected.totalDeductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 差引支給額 */}
                  <div className="bg-green-50 rounded-lg p-4 text-center mb-4">
                    <span className="text-sm text-gray-600">差引支給額</span>
                    <div className="text-3xl font-bold text-green-700">{selected.netSalary.toLocaleString()}円</div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => printPayslip(selected)}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                      印刷 / PDF出力
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
                  左の従業員を選択してください
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
