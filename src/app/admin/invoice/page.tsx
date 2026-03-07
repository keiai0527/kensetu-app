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
    if (!selectedClientId) { alert('\u53d6\u5f15\u5148\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
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
      alert('\u30c7\u30fc\u30bf\u53d6\u5f97\u30a8\u30e9\u30fc: ' + error.message);
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
      const workerName = r.employees?.name || '\u4e0d\u660e';
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
          existing.sites += '\u3001' + r.job_site;
        }
      } else {
        const d = new Date(r.date + 'T00:00:00');
        const days = ['\u65e5','\u6708','\u706b','\u6c34','\u6728','\u91d1','\u571f'];
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
    return '\u00a5' + n.toLocaleString();
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
      const periodStr = `${formatDate(startDate)}\uff5e${formatDate(endDate)}`;

      const dayRate = client.day_rate || 16000;
      const otRate = client.overtime_rate || 2300;
      const dayAmount = totalDays * dayRate;
      const nightAmount = totalNights * (client.night_rate || dayRate);
      const otAmount = totalOvertime * otRate;
      const subtotal = dayAmount + nightAmount + otAmount;
      const tax = Math.floor(subtotal * 0.1);
      const g2andTotal = subtotal + tax;

      const wsData: (string | number | null)[][] = [];
      // Row 1: empty
      wsData.push([]);
      // Row 2: title
      const r2 = new Array(18).fill(null); r2[10] = '\u5fa1\u8acb\u6c42\u66f8'; wsData.push(r2);
      // Row 3: empty
      wsData.push([]);
      // Row 4: invoice date
      const r4 = new Array(18).fill(null);
      r4[13] = '\u8acb\u6c42\u65e5'; r4[14] = `${selectedYear}/${selectedMonth}/21`;
      wsData.push(r4);
      // Row 5
      const r5 = new Array(18).fill(null); r5[13] = '\u8acb\u6c42\u756a\u53f7'; wsData.push(r5);
      // Row 6: empty
      wsData.push([]);
      // Row 7: client / company
      const r7 = new Array(18).fill(null);
      r7[0] = client.honorific_name || (client.name + ' \u5fa1\u4e2d');
      r7[10] = '\u682a\u5f0f\u4f1a\u793e\u3000\u656c\u611b\u8208\u696d';
      wsData.push(r7);
      // Row 8
      const r8 = new Array(18).fill(null);
      r8[0] = client.address || '';
      r8[10] = '\u3012606-8117';
      wsData.push(r8);
      // Row 9
      const r9 = new Array(18).fill(null);
      r9[10] = '\u4eac\u90fd\u5e02\u5de6\u4eac\u533a\u4e00\u4e57\u5bfa\u91cc\u306e\u524d\u753a85-14';
      wsData.push(r9);
      // Row 10
      const r10 = new Array(18).fill(null);
      r10[0] = '\u4e0b\u8a18\u306e\u901a\u308a\u3054\u8acb\u6c42\u7533\u3057\u4e0a\u3052\u307e\u3059\u3002';
      r10[10] = 'TEL/FAX  075-600-2475';
      wsData.push(r10);
      // Row 11
      const r11 = new Array(18).fill(null);
      r11[10] = 'keiai0527@gmail.com';
      wsData.push(r11);
      // Row 12
      const r12 = new Array(18).fill(null);
      r12[0] = '\u3054\u8acb\u6c42\u91d1\u984d';
      r12[14] = '\u767b\u9332\u756a\u53f7\u3000T5130001074190';
      wsData.push(r12);
      // Row 13
      const r13 = new Array(18).fill(null);
      r13[0] = '\u00a5' + grandTotal.toLocaleString();
      r13[10] = '\u304a\u632f\u8fbc\u5148';
      wsData.push(r13);
      // Row 14
      const r14 = new Array(18).fill(null);
      r14[10] = '\u4eac\u90fd\u4fe1\u7528\u91d1\u5eab \u4fee\u5b66\u9662\u652f\u5e97 \u666e\u901a 3030674';
      wsData.push(r14);
      // Row 15-17
      wsData.push(['\u3053\u306e\u58f2\u308a\u4e0a\u3052\u306e10\uff05\u3092\u3051\u3044\u3042\u3044\u5b50\u3069\u3082\u98df\u5802\u3068']);
      const r16 = new Array(18).fill(null);
      r16[0] = '\u30b1\u30a4\u30a2\u30a4\u30cf\u30d4\u30cd\u30b9\u4fbf\uff08\u975e\u55b6\u5229\u56e3\u4f53\uff09\u306b';
      r16[10] = '\u632f\u308a\u8fbc\u307f\u671f\u65e5';
      r16[12] = `${selectedYear}/${selectedMonth}/\u672b`;
      wsData.push(r16);
      wsData.push(['\u5bc4\u4ed8\u3055\u305b\u3066\u3044\u305f\u3060\u304d\u307e\u3059\u3002']);
      // Row 18: empty
      wsData.push([]);
      // Row 19: headers (A=æ¥ä»çªå·, C=åå, J=æ°é, L=åä½, N=åä¾¡, P=åè¨)
      const r19 = new Array(18).fill(null);
      r19[0] = '\u65e5\u4ed8\u30fb\u756a\u53f7'; r19[2] = '\u54c1\u540d\u30fb\u54c1\u756a';
      r19[9] = '\u6570\u91cf'; r19[11] = '\u5358\u4f4d'; r19[13] = '\u5358\u4fa1'; r19[15] = '\u5408\u8a08';
      wsData.push(r19);
      // Row 20: day work
      const r20 = new Array(18).fill(null);
      r20[2] = '\u89e3\u4f53\u4f5c\u696d\u4ee3\u91d1'; r20[9] = totalDays;
      r20[11] = '\u5f0f'; r20[13] = dayRate; r20[15] = dayAmount;
      wsData.push(r20);
      // Row 21: overtime
      let rowIdx = 21;
      if (totalOvertime > 0) {
        const r21 = new Array(18).fill(null);
        r21[2] = '\u6b8b\u696d\u4ee3'; r21[9] = totalOvertime;
        r21[11] = '\u5f0f'; r21[13] = otRate; r21[15] = otAmount;
        wsData.push(r21);
        rowIdx++;
      }
      // Night work line if applicable
      if (totalNights > 0) {
        const rN = new Array(18).fill(null);
        rN[2] = '\u591c\u52e4\u4ee3\u91d1'; rN[9] = totalNights;
        rN[11] = '\u5f0f'; rN[13] = client.night_rate || dayRate; rN[15] = nightAmount;
        wsData.push(rN);
        rowIdx++;
      }
      // Fill to row 39
      for (let i = rowIdx; i < 40; i++) wsData.push([]);
      // Row 40: subtotal
      const r40 = new Array(18).fill(null);
      r40[2] = '\u5c0f\u8a08'; r40[15] = subtotal;
      wsData.push(r40);
      // Row 41: tax
      const r41 = new Array(18).fill(null);
      r41[2] = '\u6d88\u8cbb\u7a0e'; r41[15] = tax;
      wsData.push(r41);
      wsData.push([]);
      // Row 43-44: remarks
      wsData.push(['\u5099\u8003']);
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
          ws[ref].z = '\u00a5#,##0';
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, `${selectedMonth}\u6708`);
      const fileName = `${client.name}_\u8acb\u6c42\u66f8_${selectedYear}\u5e74${selectedMonth}\u6708.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      alert('\u30a8\u30e9\u30fc: ' + (err as Error).message);
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

      wsData.push(['\u51fa\u9762\u8868']);
      wsData.push([`${selectedMonth}\u6708\u5206`]);
      wsData.push(['\u65e5\u4ed8', '\u66dc\u65e5', '\u73fe\u5834', '\u65e5\u52e4', '\u591c\u52e4', '\u6b8b\u696d', '\u65e9\u51fa', '\u571f\u5de5', '\u89e3\u4f53\u5de5', '\u9001\u8fce', '\u5099\u8003']);

      for (const day of dailySummary) {
        wsData.push([
          formatDate(day.date),
          day.dayOfWeek,
          day.sites,
          day.dayCount || null,
          day.nightCount || null,
          day.overtimeHours || null,
          null, null, null, null,
          day.workers.join('\u3001'),
        ]);
      }
      wsData.push([null, null, '\u5408\u8a08', totalDays, totalNights || null, totalOvertime || null]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        {wch:8},{wch:4},{wch:22},{wch:5},{wch:5},{wch:5},{wch:5},{wch:5},{wch:6},{wch:5},{wch:25}
      ];

      XLSX.utils.book_append_sheet(wb, ws, `${selectedMonth}\u6708`);
      const fileName = `${client.name}_\u51fa\u9762\u8868_${selectedYear}\u5e74${selectedMonth}\u6708.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      alert('\u30a8\u30e9\u30fc: ' + (err as Error).message);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>
      </div>
    );
  }

  const client = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">\u8acb\u6c42\u66f8\u30fb\u51fa\u9762\u8868</h1>
          <a href="/admin" className="text-gray-300 hover:text-white text-sm">\u2190 \u7ba1\u7406\u753b\u9762</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* \u9078\u629e\u30a8\u30ea\u30a2 */}
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">\u53d6\u5f15\u5148</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">\u5e74</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}\u5e74</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">\u6708</label>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}\u6708</option>
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
              {previewing ? '\u96c6\u8a08\u4e2d...' : '\u96c6\u8a08\u30fb\u30d7\u30ec\u30d3\u30e5\u30fc'}
            </button>
          </div>
        </div>

        {/* \u30d7\u30ec\u30d3\u30e5\u30fc\u8868\u793a */}
        {dailySummary.length > 0 && client && (
          <>
            {/* \u8acb\u6c42\u30b5\u30de\u30ea\u30fc */}
            <div className="bg-white rounded-xl shadow p-5 mb-4">
              <h2 className="font-bold text-lg mb-3">\u8acb\u6c42\u30b5\u30de\u30ea\u30fc</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">\u53d6\u5f15\u5148:</div>
                  <div className="font-bold">{client.name}</div>
                  <div className="text-gray-600">\u8acb\u6c42\u671f\u9593:</div>
                  <div className="font-bold">
                    {(() => {
                      const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);
                      return `${formatDate(startDate)} \uff5e ${formatDate(endDate)}`;
                    })()}
                  </div>
                  <div className="text-gray-600">\u89e3\u4f53\u4f5c\u696d\u4ee3\u91d1:</div>
                  <div className="font-bold">
                    {totalDays}\u4eba\u65e5 \u00d7 {formatYen(client.day_rate)} = {formatYen(totalDays * client.day_rate)}
                  </div>
                  {totalNights > 0 && (
                    <>
                      <div className="text-gray-600">\u591c\u52e4\u4ee3\u91d1:</div>
                      <div className="font-bold">
                        {totalNights}\u4eba\u65e5 \u00d7 {formatYen(client.night_rate)} = {formatYen(totalNights * client.night_rate)}
                      </div>
                    </>
                  )}
                  {totalOvertime > 0 && (
                    <>
                      <div className="text-gray-600">\u6b8b\u696d\u4ee3:</div>
                      <div className="font-bold">
                        {totalOvertime}h \u00d7 {formatYen(client.overtime_rate || 2300)} = {formatYen(totalOvertime * (client.overtime_rate || 2300))}
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
                        <div className="text-gray-600">\u5c0f\u8a08:</div>
                        <div className="font-bold">{formatYen(sub)}</div>
                        <div className="text-gray-600">\u6d88\u8cbb\u7a0e (10%):</div>
                        <div className="font-bold">{formatYen(t)}</div>
                      </div>
                      <div className="border-t mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">\u8acb\u6c42\u91d1\u984d\u5408\u8a08</span>
                          <span className="font-bold text-2xl text-green-700">{formatYen(sub + t)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* \u51fa\u9762\u8868\u30d7\u30ec\u30d3\u30e5\u30fc */}
            <div className="bg-white rounded-xl shadow p-5 mb-4 overflow-x-auto">
              <h2 className="font-bold text-lg mb-3">\u51fa\u9762\u8868\u30d7\u30ec\u30d3\u30e5\u30fc</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">\u65e5\u4ed8</th>
                    <th className="border px-2 py-1">\u66dc</th>
                    <th className="border px-2 py-1 text-left">\u73fe\u5834</th>
                    <th className="border px-2 py-1">\u65e5\u52e4</th>
                    <th className="border px-2 py-1">\u591c\u52e4</th>
                    <th className="border px-2 py-1">\u6b8b\u696d</th>
                    <th className="border px-2 py-1 text-left">\u4f5c\u696d\u54e1</th>
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
                      <td className="border px-2 py-1">{day.workers.join('\u3001')}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border px-2 py-1" colSpan={3}>\u5408\u8a08</td>
                    <td className="border px-2 py-1 text-center">{totalDays}</td>
                    <td className="border px-2 py-1 text-center">{totalNights || ''}</td>
                    <td className="border px-2 py-1 text-center">{totalOvertime || ''}</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* \u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u30dc\u30bf\u30f3 */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={handleDownloadInvoice}
                disabled={generating}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow"
              >
                {generating ? '\u751f\u6210\u4e2d...' : '\u8acb\u6c42\u66f8\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9'}
              </button>
              <button
                onClick={handleDownloadDemenpyo}
                disabled={generating}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 shadow"
              >
                {generating ? '\u751f\u6210\u4e2d...' : '\u51fa\u9762\u8868\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9'}
              </button>
            </div>
          </>
        )}

        {hasFetched && dailySummary.length === 0 && !previewing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
            <p className="font-bold mb-2">\u8a72\u5f53\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093</p>
            <p>\u8003\u3048\u3089\u308c\u308b\u539f\u56e0:</p>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>\u51fa\u52e4\u8a18\u9332\u306b\u53d6\u5f15\u5148\uff08client_id\uff09\u304c\u7d10\u3065\u3044\u3066\u3044\u306a\u3044</li>
              <li>\u9078\u629e\u3057\u305f\u671f\u9593\u306b\u51fa\u52e4\u30c7\u30fc\u30bf\u304c\u306a\u3044</li>
              <li>\u51fa\u52e4\u8a18\u9332\u304c\u4f11\u65e5\uff08is_holiday\uff09\u306b\u8a2d\u5b9a\u3055\u308c\u3066\u3044\u308b</li>
            </ul>
            <p className="mt-2">\u51fa\u52e4\u8a18\u9332\u753b\u9762\u3067\u5404\u8a18\u9332\u306b\u53d6\u5f15\u5148\u3092\u8a2d\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002</p>
          </div>
        )}

        {!selectedClientId && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            \u53d6\u5f15\u5148\u3068\u6708\u3092\u9078\u629e\u3057\u3066\u300c\u96c6\u8a08\u30fb\u30d7\u30ec\u30d3\u30e5\u30fc\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044
          </div>
        )}
      </main>
    </div>
  );
}
