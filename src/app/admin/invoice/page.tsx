'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  honorific_name: string | null;
  address: string | null;
  day_rate: number;
  night_rate: number;
  overtime_rate: number;
  closing_day: number;
  billing_day_start: number;
  billing_day_end: number;
  is_active: boolean;
};

type AttendanceRecord = {
  id: string;
  employee_id: string;
  date: string;
  shift_type: string;
  is_holiday: boolean;
  client_id: string | null;
  job_site: string | null;
  overtime_hours: number;
  employees: { name: string } | null;
};

type DailySummary = {
  date: string;
  dayOfWeek: string;
  sites: string;
  dayCount: number;
  nightCount: number;
  nightInfo: string;
  overtimeHours: number;
  workers: string[];
};

export default function InvoicePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [totalNights, setTotalNights] = useState(0);
  const [totalOvertime, setTotalOvertime] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

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
      .eq('is_active', true)
      .order('name');
    if (data) setClients(data);
    setLoading(false);
  }

  function getBillingPeriod(year: number, month: number, client: Client) {
    const startDay = client.billing_day_start || 21;
    const endDay = client.billing_day_end || 20;
    let startYear = year;
    let startMonth = month - 1;
    if (startMonth < 1) { startMonth = 12; startYear--; }
    const startDate = `${startYear}-${String(startMonth).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`;
    const endDate = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
    return { startDate, endDate };
  }

  async function handlePreview() {
    if (!selectedClientId) { alert('取引先を選択してください'); return; }
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    setPreviewing(true);
    setHasFetched(true);
    const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);

    const { data, error } = await supabase
      .from('attendance')
      .select('*, employees(name)')
      .eq('client_id', selectedClientId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('is_holiday', false)
      .order('date');

    if (error) {
      alert('データ取得エラー: ' + error.message);
      setPreviewing(false);
      return;
    }

    const recs: AttendanceRecord[] = data || [];

    // Aggregate by date
    const dayMap = new Map<string, DailySummary>();
    let tDays = 0;
    let tNights = 0;
    let tOT = 0;

    for (const r of recs) {
      const workerName = r.employees?.name || '不明';
      const ot = r.overtime_hours || 0;
      const isNight = r.shift_type === 'night';
      const isDay = r.shift_type === 'day' || r.shift_type === 'trip_day';

      const existing = dayMap.get(r.date);
      if (existing) {
        if (isDay) existing.dayCount++;
        if (isNight) { existing.nightCount++; existing.nightInfo = `${existing.nightCount}`; }
        existing.overtimeHours += ot;
        if (!existing.workers.includes(workerName)) {
          existing.workers.push(workerName);
        }
        if (r.job_site && !existing.sites.includes(r.job_site)) {
          existing.sites += '、' + r.job_site;
        }
      } else {
        const d = new Date(r.date + 'T00:00:00');
        const days = ['日','月','火','水','木','金','土'];
        dayMap.set(r.date, {
          date: r.date,
          dayOfWeek: days[d.getDay()],
          sites: r.job_site || '',
          dayCount: isDay ? 1 : 0,
          nightCount: isNight ? 1 : 0,
          nightInfo: isNight ? '1' : '',
          overtimeHours: ot,
          workers: [workerName],
        });
      }

      if (isDay) tDays++;
      if (isNight) tNights++;
      tOT += ot;
    }

    const summaryArr = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    setDailySummary(summaryArr);
    setTotalDays(tDays);
    setTotalNights(tNights);
    setTotalOvertime(tOT);
    setPreviewing(false);
  }

  function formatYen(n: number) {
    return '¥' + n.toLocaleString();
  }

  function formatDate(d: string) {
    const parts = d.split('-');
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }

  async function handleDownloadInvoice() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    setGenerating(true);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);
      const periodStr = `${formatDate(startDate)}～${formatDate(endDate)}`;

      const dayRate = client.day_rate || 16000;
      const otRate = client.overtime_rate || 2300;
      const dayAmount = totalDays * dayRate;
      const nightAmount = totalNights * (client.night_rate || dayRate);
      const otAmount = totalOvertime * otRate;
      const subtotal = dayAmount + nightAmount + otAmount;
      const tax = Math.floor(subtotal * 0.1);
      const grandTotal = subtotal + tax;

      const wsData: (string | number | null)[][] = [];
      // Row 1: empty
      wsData.push([]);
      // Row 2: title
      const r2 = new Array(18).fill(null); r2[10] = '御請求書'; wsData.push(r2);
      // Row 3: empty
      wsData.push([]);
      // Row 4: invoice date
      const r4 = new Array(18).fill(null);
      r4[13] = '請求日'; r4[14] = `${selectedYear}/${selectedMonth}/21`;
      wsData.push(r4);
      // Row 5
      const r5 = new Array(18).fill(null); r5[13] = '請求番号'; wsData.push(r5);
      // Row 6: empty
      wsData.push([]);
      // Row 7: client / company
      const r7 = new Array(18).fill(null);
      r7[0] = client.honorific_name || (client.name + ' 御中');
      r7[10] = '株式会社　敬愛興業';
      wsData.push(r7);
      // Row 8
      const r8 = new Array(18).fill(null);
      r8[0] = client.address || '';
      r8[10] = '〒606-8117';
      wsData.push(r8);
      // Row 9
      const r9 = new Array(18).fill(null);
      r9[10] = '京都市左京区一乗寺里の前町85-14';
      wsData.push(r9);
      // Row 10
      const r10 = new Array(18).fill(null);
      r10[0] = '下記の通りご請求申し上げます。';
      r10[10] = 'TEL/FAX  075-600-2475';
      wsData.push(r10);
      // Row 11
      const r11 = new Array(18).fill(null);
      r11[10] = 'keiai0527@gmail.com';
      wsData.push(r11);
      // Row 12
      const r12 = new Array(18).fill(null);
      r12[0] = 'ご請求金額';
      r12[14] = '登録番号　T5130001074190';
      wsData.push(r12);
      // Row 13
      const r13 = new Array(18).fill(null);
      r13[0] = '¥' + grandTotal.toLocaleString();
      r13[10] = 'お振込先';
      wsData.push(r13);
      // Row 14
      const r14 = new Array(18).fill(null);
      r14[10] = '京都信用金庫 修学院支店 普通 3030674';
      wsData.push(r14);
      // Row 15-17
      wsData.push(['この売り上げの10％をけいいい子ども食堂と']);
      const r16 = new Array(18).fill(null);
      r16[0] = 'ケイアイハピネス便（非営利団体）に';
      r16[10] = '振り込み期日';
      r16[12] = `${selectedYear}/${selectedMonth}/末`;
      wsData.push(r16);
      wsData.push(['寄付させていただきます。']);
      // Row 18: empty
      wsData.push([]);
      // Row 19: headers (A=日付番号, C=品名, J=数量, L=単位, N=単価, P=合計)
      const r19 = new Array(18).fill(null);
      r19[0] = '日付・番号'; r19[2] = '品名・品番';
      r19[9] = '数量'; r19[11] = '単位'; r19[13] = '単価'; r19[15] = '合計';
      wsData.push(r19);
      // Row 20: day work
      const r20 = new Array(18).fill(null);
      r20[2] = '解体作業代金'; r20[9] = totalDays;
      r20[11] = '式'; r20[13] = dayRate; r20[15] = dayAmount;
      wsData.push(r20);
      // Row 21: overtime
      let rowIdx = 21;
      if (totalOvertime > 0) {
        const r21 = new Array(18).fill(null);
        r21[2] = '残業代'; r21[9] = totalOvertime;
        r21[11] = '式'; r21[13] = otRate; r21[15] = otAmount;
        wsData.push(r21);
        rowIdx++;
      }
      // Night work line if applicable
      if (totalNights > 0) {
        const rN = new Array(18).fill(null);
        rN[2] = '夜勤代金'; rN[9] = totalNights;
        rN[11] = '式'; rN[13] = client.night_rate || dayRate; rN[15] = nightAmount;
        wsData.push(rN);
        rowIdx++;
      }
      // Fill to row 39
      for (let i = rowIdx; i < 40; i++) wsData.push([]);
      // Row 40: subtotal
      const r40 = new Array(18).fill(null);
      r40[2] = '小計'; r40[15] = subtotal;
      wsData.push(r40);
      // Row 41: tax
      const r41 = new Array(18).fill(null);
      r41[2] = '消費税'; r41[15] = tax;
      wsData.push(r41);
      wsData.push([]);
      // Row 43-44: remarks
      wsData.push(['備考']);
      wsData.push([periodStr]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths matching template
      ws['!cols'] = [
        {wch:5},{wch:5},{wch:13},{wch:5},{wch:5},{wch:2.5},{wch:3},{wch:1},{wch:1.5},{wch:1.5},
        {wch:5},{wch:5},{wch:5},{wch:9},{wch:10},{wch:5},{wch:8},{wch:4}
      ];

      // Number format for yen columns
      const yenCells = ['P20','P21','P22','P40','P41'];
      for (const ref of yenCells) {
        if (ws[ref]) {
          ws[ref].z = '¥#,##0';
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, `${selectedMonth}月`);
      const fileName = `${client.name}_請求書_${selectedYear}年${selectedMonth}月.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      alert('エラー: ' + (err as Error).message);
    }
    setGenerating(false);
  }

  async function handleDownloadDemenpyo() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    setGenerating(true);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const wsData: (string | number | null)[][] = [];

      wsData.push(['出面表']);
      wsData.push([`${selectedMonth}月分`]);
      wsData.push(['日付', '曜日', '現場', '日勤', '夜勤', '残業', '早出', '土工', '解体工', '送迎', '備考']);

      for (const day of dailySummary) {
        wsData.push([
          formatDate(day.date),
          day.dayOfWeek,
          day.sites,
          day.dayCount || null,
          day.nightCount || null,
          day.overtimeHours || null,
          null, null, null, null,
          day.workers.join('、'),
        ]);
      }
      wsData.push([null, null, '合計', totalDays, totalNights || null, totalOvertime || null]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        {wch:8},{wch:4},{wch:22},{wch:5},{wch:5},{wch:5},{wch:5},{wch:5},{wch:6},{wch:5},{wch:25}
      ];

      XLSX.utils.book_append_sheet(wb, ws, `${selectedMonth}月`);
      const fileName = `${client.name}_出面表_${selectedYear}年${selectedMonth}月.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      alert('エラー: ' + (err as Error).message);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const client = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">請求書・出面表</h1>
          <a href="/admin" className="text-gray-300 hover:text-white text-sm">← 管理画面</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* 選択エリア */}
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">取引先</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">選択してください</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">年</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">月</label>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handlePreview}
              disabled={!selectedClientId || previewing}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {previewing ? '集計中...' : '集計・プレビュー'}
            </button>
          </div>
        </div>

        {/* プレビュー表示 */}
        {dailySummary.length > 0 && client && (
          <>
            {/* 請求サマリー */}
            <div className="bg-white rounded-xl shadow p-5 mb-4">
              <h2 className="font-bold text-lg mb-3">請求サマリー</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">取引先:</div>
                  <div className="font-bold">{client.name}</div>
                  <div className="text-gray-600">請求期間:</div>
                  <div className="font-bold">
                    {(() => {
                      const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);
                      return `${formatDate(startDate)} ～ ${formatDate(endDate)}`;
                    })()}
                  </div>
                  <div className="text-gray-600">解体作業代金:</div>
                  <div className="font-bold">
                    {totalDays}人日 × {formatYen(client.day_rate)} = {formatYen(totalDays * client.day_rate)}
                  </div>
                  {totalNights > 0 && (
                    <>
                      <div className="text-gray-600">夜勤代金:</div>
                      <div className="font-bold">
                        {totalNights}人日 × {formatYen(client.night_rate)} = {formatYen(totalNights * client.night_rate)}
                      </div>
                    </>
                  )}
                  {totalOvertime > 0 && (
                    <>
                      <div className="text-gray-600">残業代:</div>
                      <div className="font-bold">
                        {totalOvertime}h × {formatYen(client.overtime_rate || 2300)} = {formatYen(totalOvertime * (client.overtime_rate || 2300))}
                      </div>
                    </>
                  )}
                </div>
                {(() => {
                  const dayAmt = totalDays * client.day_rate;
                  const nightAmt = totalNights * (client.night_rate || client.day_rate);
                  const otAmt = totalOvertime * (client.overtime_rate || 2300);
                  const sub = dayAmt + nightAmt + otAmt;
                  const t = Math.floor(sub * 0.1);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div className="text-gray-600">小計:</div>
                        <div className="font-bold">{formatYen(sub)}</div>
                        <div className="text-gray-600">消費税 (10%):</div>
                        <div className="font-bold">{formatYen(t)}</div>
                      </div>
                      <div className="border-t mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">請求金額合計</span>
                          <span className="font-bold text-2xl text-green-700">{formatYen(sub + t)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 出面表プレビュー */}
            <div className="bg-white rounded-xl shadow p-5 mb-4 overflow-x-auto">
              <h2 className="font-bold text-lg mb-3">出面表プレビュー</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">日付</th>
                    <th className="border px-2 py-1">曜</th>
                    <th className="border px-2 py-1 text-left">現場</th>
                    <th className="border px-2 py-1">日勤</th>
                    <th className="border px-2 py-1">夜勤</th>
                    <th className="border px-2 py-1">残業</th>
                    <th className="border px-2 py-1 text-left">作業員</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map(day => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="border px-2 py-1">{formatDate(day.date)}</td>
                      <td className="border px-2 py-1 text-center">{day.dayOfWeek}</td>
                      <td className="border px-2 py-1">{day.sites}</td>
                      <td className="border px-2 py-1 text-center">{day.dayCount || ''}</td>
                      <td className="border px-2 py-1 text-center">{day.nightCount || ''}</td>
                      <td className="border px-2 py-1 text-center">{day.overtimeHours || ''}</td>
                      <td className="border px-2 py-1">{day.workers.join('、')}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border px-2 py-1" colSpan={3}>合計</td>
                    <td className="border px-2 py-1 text-center">{totalDays}</td>
                    <td className="border px-2 py-1 text-center">{totalNights || ''}</td>
                    <td className="border px-2 py-1 text-center">{totalOvertime || ''}</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ダウンロードボタン */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={handleDownloadInvoice}
                disabled={generating}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow"
              >
                {generating ? '生成中...' : '請求書ダウンロード'}
              </button>
              <button
                onClick={handleDownloadDemenpyo}
                disabled={generating}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 shadow"
              >
                {generating ? '生成中...' : '出面表ダウンロード'}
              </button>
            </div>
          </>
        )}

        {hasFetched && dailySummary.length === 0 && !previewing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
            <p className="font-bold mb-2">該当データがありません</p>
            <p>考えられる原因:</p>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>出勤記録に取引先（client_id）が紐づいていない</li>
              <li>選択した期間に出勤データがない</li>
              <li>出勤記録が休日（is_holiday）に設定されている</li>
            </ul>
            <p className="mt-2">出勤記録画面で各記録に取引先を設定してください。</p>
          </div>
        )}

        {!selectedClientId && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            取引先と月を選択して「集計・プレビュー」を押してください
          </div>
        )}
      </main>
    </div>
  );
}
