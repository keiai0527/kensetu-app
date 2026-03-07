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
  // å¾“æ¥­å“¡è¨­å®šã‹ã‚‰å–å¾—
  baseDailyWage: number;
  nightAllowancePerDay: number;
  nightWage: number;
  overtimeHourly: number;
  positionAllowance: number;
  tripAllowance: number;
  specialAllowance: number;
  // å›ºå®šæ§é™¤ï¼ˆå¾“æ¥­å“¡è¨­å®šã‹ã‚‰ï¼‰
  rentDeduction: number;
  utilitiesDeduction: number;
  safetyFee: number;
  japaneseStudyFee: number;
  wifiDeduction: number;
  // æœˆæ¬¡èª¿æ•´ï¼ˆpayroll_adjustmentsã‹ã‚‰ï¼‰
  advancePayment: number;
  fineAmount: number;
  fineReason: string;
  otherDeduction: number;
  adjustmentMemo: string;
  // è¨ˆç®—çµæœ
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

    // å‡ºå‹¤ãƒ‡ãƒ¼ã‚¿å–å¾—ï¼ˆå¾“æ¥­å“¡ã®å…¨ã‚«ãƒ©ãƒ å«ã‚€ï¼‰
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(*)')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('is_holiday', false);

    // æœˆæ¬¡èª¿æ•´ãƒ‡ãƒ¼ã‚¿å–å¾—
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

    // çµ¦ä¸è¨ˆç®—
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

  // æœˆæ¬¡èª¿æ•´ã‚’Supabaseã«ä¿å­˜
  async function saveAdjustment(item: PayrollItem) {
    const { error } = await supabase.from('payroll_adjustments').upsert({
      employee_id: item.employeeId,
      year_month: month,
      advance_payment: item.advancePayment,
      fine_amount: item.fineAmount,
      fine_reason: item.fineReason,
      other_deduction: item.otherDeduction,
      memo: item.adjustmentMemo,
    }, { onConflict: 'employee_id,year_month' });
    if (error) { alert('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + error.message); return; }
    alert(item.employeeName + ' \u306e\u6708\u6b21\u8abf\u6574\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f');
  }

  function updateItem(index: number, field: string, value: number | string) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    // å†è¨ˆç®—
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
          <a href="/admin" className="text-gray-300 hover:text-white">&larr; ç®¡ç†ç”»é¢</a>
          <h1 className="text-lg font-bold">çµ¦ä¸è¨ˆç®—</h1>
          <a href="/admin/payslip" className="bg-green-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700">
            çµ¦ä¸æ˜ç´°ã¸
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-4 flex-wrap">
          <input type="month" value={month}
            onChange={(e) => { setMonth(e.target.value); fetchPayroll(e.target.value); }}
            className="p-3 border-2 rounded-lg text-lg" />
          <div className="text-lg font-bold text-blue-700">
            ç·æ”¯çµ¦: {totalGross.toLocaleString()}å††
          </div>
          <div className="text-lg font-bold text-red-700">
            å·®å¼•åˆè¨ˆ: {totalNet.toLocaleString()}å††
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">è¨ˆç®—ä¸­...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">ã“ã®æœˆã®å‡ºå‹¤ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={item.employeeId} className="bg-white rounded-xl shadow overflow-hidden">
                {/* ãƒ¡ã‚¤ãƒ³è¡Œ */}
                <div
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                >
                  <div className="flex-1">
                    <span className="font-bold text-gray-800">{item.employeeName}</span>
                    <span className="text-xs text-gray-500 ml-2">{item.workDays}æ—¥å‡ºå‹¤</span>
                  </div>
                  <div className="text-right space-x-4">
                    <span className="text-sm text-gray-600">æ”¯çµ¦: <span className="font-bold text-blue-700">{item.grossPay.toLocaleString()}</span></span>
                    <span className="text-sm text-gray-600">æ§é™¤: <span className="font-bold text-red-600">-{item.totalDeductions.toLocaleString()}</span></span>
                    <span className="text-lg font-bold text-green-700">{item.netSalary.toLocaleString()}å††</span>
                  </div>
                  <span className="ml-3 text-gray-400">{expandedIndex === i ? 'â–²' : 'â–¼'}</span>
                </div>

                {/* å±•é–‹è©³ç´° */}
                {expandedIndex === i && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4">
                      {/* å·¦: æ”¯çµ¦æ˜ç´° */}
                      <div>
                        <h4 className="text-sm font-bold text-blue-700 mb-2">ã€æ”¯çµ¦ã€‘</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>åŸºæœ¬çµ¦ï¼ˆ{item.baseDailyWage.toLocaleString()}Ã—{item.dayCount}æ—¥ï¼‰</span>
                            <span className="font-bold">{item.basicSalary.toLocaleString()}</span>
                          </div>
                          {item.nightCount > 0 && (
                            <div className="flex justify-between">
                              <span>å¤œå‹¤æ‰‹å½“ï¼ˆ{item.nightAllowancePerDay.toLocaleString()}Ã—{item.nightCount}æ—¥ï¼‰</span>
                              <span className="font-bold">{item.nightPay.toLocaleString()}</span>
                            </div>
                          )}
                          {item.overtimePay > 0 && (
                            <div className="flex justify-between">
                              <span>æ®‹æ¥­ï¼ˆ{item.overtimeHours}hï¼‰</span>
                              <span className="font-bold">{item.overtimePay.toLocaleString()}</span>
                            </div>
                          )}
                          {item.positionAllowance > 0 && (
                            <div className="flex justify-between"><span>è·å‹™æ‰‹å½“</span><span className="font-bold">{item.positionAllowance.toLocaleString()}</span></div>
                          )}
                          {item.tripAllowance > 0 && (
                            <div className="flex justify-between"><span>å‡ºå¼µæ‰‹å½“</span><span className="font-bold">{item.tripAllowance.toLocaleString()}</span></div>
                          )}
                          {item.specialAllowance > 0 && (
                            <div className="flex justify-between"><span>ç‰¹åˆ¥æ‰‹å½“</span><span className="font-bold">{item.specialAllowance.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-bold text-blue-700">
                            <span>æ”¯çµ¦åˆè¨ˆ</span><span>{item.grossPay.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* å³: æ§é™¤æ˜ç´° */}
                      <div>
                        <h4 className="text-sm font-bold text-red-700 mb-2">ã€æ§é™¤ã€‘</h4>
                        <div className="space-y-1 text-sm">
                          {item.rentDeduction > 0 && (
                            <div className="flex justify-between"><span>å®¶è³ƒ</span><span>{item.rentDeduction.toLocaleString()}</span></div>
                          )}
                          {item.utilitiesDeduction > 0 && (
                            <div className="flex justify-between"><span>å…‰ç†±è²»</span><span>{item.utilitiesDeduction.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between"><span>å®‰å…¨å”åŠ›ä¼šè²»</span><span>{item.safetyFee.toLocaleString()}</span></div>
                          {item.japaneseStudyFee > 0 && (
                            <div className="flex justify-between"><span>æ—¥æœ¬èªå­¦ç¿’è²»</span><span>{item.japaneseStudyFee.toLocaleString()}</span></div>
                          )}
                          {item.wifiDeduction > 0 && (
                            <div className="flex justify-between"><span>WiFi</span><span>{item.wifiDeduction.toLocaleString()}</span></div>
                          )}
                          {item.advancePayment > 0 && (
                            <div className="flex justify-between text-orange-600"><span>å‰æ¸¡ã—</span><span>{item.advancePayment.toLocaleString()}</span></div>
                          )}
                          {item.fineAmount > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>ç½°é‡‘{item.fineReason ? `ï¼ˆ${item.fineReason}}ï¼‰` : ''}</span>
                              <span>{item.fineAmount.toLocaleString()}</span>
                            </div>
                          )}
                          {item.otherDeduction > 0 && (
                            <div className="flex justify-between"><span>ãã®ä»–</span><span>{item.otherDeduction.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                            <span>æ§é™¤åˆè¨ˆ</span><span>-{item.totalDeductions.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* æœˆæ¬¡èª¿æ•´å…¥åŠ› */}
                    <div className="mt-4 border-t pt-3">
                      <h4 className="text-sm font-bold text-gray-700 mb-2">æœˆæ¬¡èª¿æ•´ï¼ˆå‰æ¸¡ã—ãƒ»ç½°é‡‘ç­‰ï¼‰</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">å‰æ¸¡ã—ï¼ˆå††ï¼‰</label>
                          <input type="number" value={item.advancePayment}
                            onChange=x¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¤°€…‘Ù…¹•A…åµ•¹Ğœ°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¤ñğ€À¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°À´È‰½É‘•ÈÉ½Õ¹‘•Ñ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆûöÃ¦G¾ò#–¾ò$ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õí¥Ñ•´¹™¥¹•µ½Õ¹Ñô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¤°€™¥¹•µ½Õ¹Ğœ°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¤ñğ€À¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°À´È‰½É‘•ÈÉ½Õ¹‘•Ñ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆûöÃ¦GBRÄğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆÙ…±Õ”õí¥Ñ•´¹™¥¹•I•…Í½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¤°€™¥¹•I•…Í½¸œ°”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹’ú/¾òk–º'–£–â¿šr«vR ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°À´È‰½É‘•ÈÉ½Õ¹‘•Ñ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆûw»’î[š:Ÿ¦f“¾ò#–¾ò$ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õí¥Ñ•´¹½Ñ¡•É•‘ÕÑ¥½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¤°€½Ñ¡•É•‘ÕÑ¥½¸œ°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¤ñğ€À¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°À´È‰½É‘•ÈÉ½Õ¹‘•Ñ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ…Ù•‘©ÕÍÑµ•¹Ğ¡¥Ñ•´¥ô(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰µĞ´È‰œµ½É…¹”´ÔÀÀÑ•áĞµİ¡¥Ñ”Áà´ĞÁä´ÈÉ½Õ¹‘•Ñ•áĞµÍ´™½¹Ğµ‰½±¡½Ù•Èé‰œµ½É…¹”´ØÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€ƒ’şw–¶`(€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€€€€€€ì¼¨ƒ–Ş»–òWšR¿Ö›¦†4€¨½ô(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ì‰œµÉ••¸´ÔÀÉ½Õ¹‘•µ±œÀ´ÌÑ•áĞµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ØÀÀˆû–Ş»–òWšR¿Ö›¦†7¾òhğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞ´Éá°™½¹Ğµ‰½±Ñ•áĞµÉ••¸´ÜÀÀµ°´Èˆùí¥Ñ•´¹¹•ÑM…±…Éä¹Ñ½1½…±•MÑÉ¥¹œ ¥÷–ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¥ô(€€€€€€ğ½µ…¥¸ø(€€€€ğ½‘¥Øø(€€¤ì)ô(