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
  overtime_rate: numbe
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
    const dayMap = new Map<string, DailySummary>();
    let tDays = 0, tNights = 0, tOT = 0;

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
        if (!existing.workers.includes(workerName)) existing.workers.push(workerName);
        if (r.job_site && !existing.sites.includes(r.job_site)) existing.sites += '、' + r.job_site;
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

    setDailySummary(Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
    setTotalDays(tDays);
    setTotalNights(tNights);
    setTotalOvertime(tOT);
    setPreviewing(false);
  }

  function formatYen(n: number) { return '¥' + n.toLocaleString(); }
  function formatDate(d: string) {
    const p = d.split('-');
    return `${parseInt(p[1])}/${parseInt(p[2])}`;
  }

  // Real company seal image (株式会社敬愛興業 篆書体角印)
  const SEAL_BASE64 = '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';

  async function handleDownloadInvoice() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    setGenerating(true);

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`${selectedMonth}月`, {
        pageSetup: {
          paperSize: 9,
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: { left: 0.6, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
        },
        properties: { defaultRowHeight: 16 }
      });

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

      // A4 portrait optimized columns (A-F only, total ~77 units)
      ws.columns = [
        { width: 10 }, // A: date/number
        { width: 22 }, // B: description
        { width: 8 },  // C: quantity
        { width: 7 },  // D: unit
        { width: 14 }, // E: unit price
        { width: 16 }, // F: amount
      ];

      const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
      const medBorder = { style: 'medium' as const, color: { argb: 'FF000000' } };
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2B4C7E' } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Yu Gothic' };
      const normalFont = { size: 10, name: 'Yu Gothic' };
      const smallFont = { size: 9, name: 'Yu Gothic' };
      const boldFont = { bold: true, size: 10, name: 'Yu Gothic' };

      // Row 1: spacer
      ws.getRow(1).height = 8;

      // Row 2: Title (centered across all columns)
      ws.mergeCells('A2:F2');
      const titleCell = ws.getCell('A2');
      titleCell.value = '御 請 求 書';
      titleCell.font = { bold: true, size: 20, name: 'Yu Gothic' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 36;

      // Row 3: spacer
      ws.getRow(3).height = 6;

      // Row 4: 請求日 (right side)
      ws.mergeCells('E4:F4');
      ws.getCell('E4').value = `請求日: ${selectedYear}年${selectedMonth}月21日`;
      ws.getCell('E4').font = smallFont;
      ws.getCell('E4').alignment = { horizontal: 'right' };

      // Row 5: spacer
      ws.getRow(5).height = 6;

      // Row 6: Client name (left) / Company name (right)
      ws.mergeCells('A6:C6');
      const clientCell = ws.getCell('A6');
      clientCell.value = client.honorific_name || (client.name + ' 御中');
      clientCell.font = { bold: true, size: 13, name: 'Yu Gothic' };
      clientCell.border = { bottom: medBorder };

      ws.mergeCells('E6:F6');
      ws.getCell('E6').value = '株式会社　敬愛興業';
      ws.getCell('E6').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('E6').alignment = { horizontal: 'right' };

      // Row 7: Client address / Postal code
      ws.mergeCells('A7:C7');
      ws.getCell('A7').value = client.address || '';
      ws.getCell('A7').font = smallFont;

      ws.mergeCells('E7:F7');
      ws.getCell('E7').value = '〒606-8117';
      ws.getCell('E7').font = smallFont;
      ws.getCell('E7').alignment = { horizontal: 'right' };

      // Row 8: Company address
      ws.mergeCells('E8:F8');
      ws.getCell('E8').value = '京都市左京区一乗寺里の前町85-14';
      ws.getCell('E8').font = smallFont;
      ws.getCell('E8').alignment = { horizontal: 'right' };

      // Row 9: TEL
      ws.mergeCells('A9:C9');
      ws.getCell('A9').value = '下記の通りご請求申し上げます。';
      ws.getCell('A9').font = smallFont;

      ws.mergeCells('E9:F9');
      ws.getCell('E9').value = 'TEL/FAX 075-600-2475';
      ws.getCell('E9').font = smallFont;
      ws.getCell('E9').alignment = { horizontal: 'right' };

      // Row 10: Email
      ws.mergeCells('E10:F10');
      ws.getCell('E10').value = 'keiai0527@gmail.com';
      ws.getCell('E10').font = smallFont;
      ws.getCell('E10').alignment = { horizontal: 'right' };

      // Row 11: spacer
      ws.getRow(11).height = 8;

      // Row 12: Grand total box
      ws.mergeCells('A12:B12');
      ws.getCell('A12').value = 'ご請求金額';
      ws.getCell('A12').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('A12').alignment = { vertical: 'middle' };

      ws.mergeCells('C12:F12');
      ws.getCell('C12').value = grandTotal;
      ws.getCell('C12').numFmt = '¥#,##0';
      ws.getCell('C12').font = { bold: true, size: 16, name: 'Yu Gothic' };
      ws.getCell('C12').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('C12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      ws.getCell('C12').border = { top: medBorder, bottom: medBorder, left: medBorder, right: medBorder };
      ws.getCell('D12').border = { top: medBorder, bottom: medBorder };
      ws.getCell('E12').border = { top: medBorder, bottom: medBorder };
      ws.getCell('F12').border = { top: medBorder, bottom: medBorder, right: medBorder };
      ws.getRow(12).height = 30;

      // Row 13: spacer
      ws.getRow(13).height = 4;

      // Row 14: Bank info + 登録番号
      ws.mergeCells('A14:B14');
      ws.getCell('A14').value = '登録番号: T5130001074190';
      ws.getCell('A14').font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF555555' } };

      ws.mergeCells('D14:F14');
      ws.getCell('D14').value = 'お振込先: 京都信用金庫 修学院支店';
      ws.getCell('D14').font = smallFont;
      ws.getCell('D14').alignment = { horizontal: 'right' };

      // Row 15: Bank account + 振込期日
      ws.mergeCells('D15:F15');
      ws.getCell('D15').value = '普通 3030674 カ）ケイアイコウギョウ';
      ws.getCell('D15').font = smallFont;
      ws.getCell('D15').alignment = { horizontal: 'right' };

      ws.mergeCells('A15:B15');
      ws.getCell('A15').value = `振込期日: ${selectedYear}年${selectedMonth}月末`;
      ws.getCell('A15').font = boldFont;

      // Row 16: spacer
      ws.getRow(16).height = 6;

      // Row 17: Table header
      const headerRow = 17;
      const headers = [
        { col: 'A', val: '日付' },
        { col: 'B', val: '品名・摘要' },
        { col: 'C', val: '数量' },
        { col: 'D', val: '単位' },
        { col: 'E', val: '単価' },
        { col: 'F', val: '金額' },
      ];
      for (const h of headers) {
        const cell = ws.getCell(`${h.col}${headerRow}`);
        cell.value = h.val;
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: medBorder, bottom: medBorder, left: thinBorder, right: thinBorder };
      }
      ws.getCell(`A${headerRow}`).border = { top: medBorder, bottom: medBorder, left: medBorder, right: thinBorder };
      ws.getCell(`F${headerRow}`).border = { top: medBorder, bottom: medBorder, left: thinBorder, right: medBorder };
      ws.getRow(headerRow).height = 22;

      // Data rows
      let dataRow = 18;
      const lineItems: { name: string; qty: number; unit: string; price: number; amount: number }[] = [];
      lineItems.push({ name: '解体作業代金', qty: totalDays, unit: '人日', price: dayRate, amount: dayAmount });
      if (totalOvertime > 0) {
        lineItems.push({ name: '残業代', qty: totalOvertime, unit: '時間', price: otRate, amount: otAmount });
      }
      if (totalNights > 0) {
        lineItems.push({ name: '夜勤代金', qty: totalNights, unit: '人日', price: client.night_rate || dayRate, amount: nightAmount });
      }

      for (const item of lineItems) {
        ws.getCell(`A${dataRow}`).value = '';
        ws.getCell(`B${dataRow}`).value = item.name;
        ws.getCell(`B${dataRow}`).font = normalFont;
        ws.getCell(`C${dataRow}`).value = item.qty;
        ws.getCell(`C${dataRow}`).font = normalFont;
        ws.getCell(`C${dataRow}`).alignment = { horizontal: 'center' };
        ws.getCell(`D${dataRow}`).value = item.unit;
        ws.getCell(`D${dataRow}`).font = normalFont;
        ws.getCell(`D${dataRow}`).alignment = { horizontal: 'center' };
        ws.getCell(`E${dataRow}`).value = item.price;
        ws.getCell(`E${dataRow}`).numFmt = '#,##0';
        ws.getCell(`E${dataRow}`).font = normalFont;
        ws.getCell(`E${dataRow}`).alignment = { horizontal: 'right' };
        ws.getCell(`F${dataRow}`).value = item.amount;
        ws.getCell(`F${dataRow}`).numFmt = '#,##0';
        ws.getCell(`F${dataRow}`).font = normalFont;
        ws.getCell(`F${dataRow}`).alignment = { horizontal: 'right' };
        for (const col of ['A','B','C','D','E','F']) {
          const c = ws.getCell(`${col}${dataRow}`);
          c.border = {
            left: col === 'A' ? medBorder : thinBorder,
            right: col === 'F' ? medBorder : thinBorder,
            top: thinBorder,
            bottom: thinBorder,
          };
        }
        dataRow++;
      }

      // Empty rows to fill table (at least 12 rows total in table body)
      const minTableEnd = headerRow + 13;
      while (dataRow < minTableEnd) {
        for (const col of ['A','B','C','D','E','F']) {
          const c = ws.getCell(`${col}${dataRow}`);
          c.border = {
            left: col === 'A' ? medBorder : thinBorder,
            right: col === 'F' ? medBorder : thinBorder,
            top: thinBorder,
            bottom: thinBorder,
          };
        }
        dataRow++;
      }

      // Subtotal row
      ws.mergeCells(`A${dataRow}:D${dataRow}`);
      ws.getCell(`A${dataRow}`).value = '小計';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = subtotal;
      ws.getCell(`F${dataRow}`).numFmt = '¥#,##0';
      ws.getCell(`F${dataRow}`).font = boldFont;
      ws.getCell(`F${dataRow}`).alignment = { horizontal: 'right' };
      for (const col of ['A','B','C','D','E','F']) {
        ws.getCell(`${col}${dataRow}`).border = {
          left: col === 'A' ? medBorder : thinBorder,
          right: col === 'F' ? medBorder : thinBorder,
          top: medBorder,
          bottom: thinBorder,
        };
      }
      ws.getCell(`A${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      ws.getCell(`E${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      ws.getCell(`F${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      dataRow++;

      // Tax row
      ws.mergeCells(`A${dataRow}:D${dataRow}`);
      ws.getCell(`A${dataRow}`).value = '消費税 (10%)';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = tax;
      ws.getCell(`F${dataRow}`).numFmt = '¥#,##0';
      ws.getCell(`F${dataRow}`).font = boldFont;
      ws.getCell(`F${dataRow}`).alignment = { horizontal: 'right' };
      for (const col of ['A','B','C','D','E','F']) {
        ws.getCell(`${col}${dataRow}`).border = {
          left: col === 'A' ? medBorder : thinBorder,
          right: col === 'F' ? medBorder : thinBorder,
          top: thinBorder,
          bottom: thinBorder,
        };
      }
      dataRow++;

      // Grand total row
      ws.mergeCells(`A${dataRow}:D${dataRow}`);
      ws.getCell(`A${dataRow}`).value = '合計';
      ws.getCell(`A${dataRow}`).font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = grandTotal;
      ws.getCell(`F${dataRow}`).numFmt = '¥#,##0';
      ws.getCell(`F${dataRow}`).font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getCell(`F${dataRow}`).alignment = { horizontal: 'right' };
      for (const col of ['A','B','C','D','E','F']) {
        ws.getCell(`${col}${dataRow}`).border = {
          left: col === 'A' ? medBorder : thinBorder,
          right: col === 'F' ? medBorder : thinBorder,
          top: thinBorder,
          bottom: medBorder,
        };
      }
      ws.getCell(`A${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      ws.getCell(`E${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      ws.getCell(`F${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      ws.getRow(dataRow).height = 24;
      dataRow++;

      // Spacer
      dataRow++;

      // Remarks
      ws.getCell(`A${dataRow}`).value = '備考';
      ws.getCell(`A${dataRow}`).font = boldFont;
      dataRow++;
      ws.getCell(`A${dataRow}`).value = `期間: ${periodStr}`;
      ws.getCell(`A${dataRow}`).font = normalFont;
      dataRow++;
      ws.mergeCells(`A${dataRow}:F${dataRow}`);
      ws.getCell(`A${dataRow}`).value = 'この売り上げの10％をけいあい子ども食堂とケイアイハピネス便（非営利団体）に寄付させていただきます。';
      ws.getCell(`A${dataRow}`).font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF666666' } };

      // Electronic seal image (positioned near company address area)
      try {
        const sealBinary = atob(SEAL_BASE64); const sealBytes = new Uint8Array(sealBinary.length); for (let i = 0; i < sealBinary.length; i++) sealBytes[i] = sealBinary.charCodeAt(i); const imageId = workbook.addImage({ buffer: sealBytes.buffer, extension: 'png' });
        ws.addImage(imageId, {
          tl: { col: 14, row: 6.2 } as any,
          ext: { width: 70, height: 70 },
        });
      } catch (e) {
        console.warn('Seal image creation failed:', e);
      }

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name}_請求書_${selectedYear}年${selectedMonth}月.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`出面表_${selectedMonth}月`, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
      });

      const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
      const medBorder = { style: 'medium' as const, color: { argb: 'FF000000' } };
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2B4C7E' } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Yu Gothic' };
      const normalFont = { size: 10, name: 'Yu Gothic' };
      const boldFont = { bold: true, size: 10, name: 'Yu Gothic' };

      ws.columns = [
        { width: 10 }, // A: date
        { width: 5 },  // B: day of week
        { width: 24 }, // C: site
        { width: 7 },  // D: day count
        { width: 7 },  // E: night count
        { width: 7 },  // F: overtime
        { width: 7 },  // G: early
        { width: 7 },  // H: laborer
        { width: 8 },  // I: demolition
        { width: 7 },  // J: transport
        { width: 28 }, // K: remarks
      ];

      // Title
      ws.mergeCells('A1:K1');
      ws.getCell('A1').value = '出 面 表';
      ws.getCell('A1').font = { bold: true, size: 18, name: 'Yu Gothic' };
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Subtitle
      ws.mergeCells('A2:C2');
      ws.getCell('A2').value = `${selectedYear}年${selectedMonth}月分　${client.name}`;
      ws.getCell('A2').font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getRow(2).height = 24;

      // Header row
      const hdrRow = 3;
      const hdrLabels = ['日付','曜日','現場','日勤','夜勤','残業','早出','土工','解体工','送迎','備考'];
      for (let i = 0; i < hdrLabels.length; i++) {
        const col = String.fromCharCode(65 + i);
        const cell = ws.getCell(`${col}${hdrRow}`);
        cell.value = hdrLabels[i];
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: medBorder,
          bottom: medBorder,
          left: i === 0 ? medBorder : thinBorder,
          right: i === hdrLabels.length - 1 ? medBorder : thinBorder,
        };
      }
      ws.getRow(hdrRow).height = 22;

      // Data rows
      let row = 4;
      for (const day of dailySummary) {
        const vals = [
          formatDate(day.date),
          day.dayOfWeek,
          day.sites,
          day.dayCount || null,
          day.nightCount || null,
          day.overtimeHours || null,
          null, null, null, null,
          day.workers.join('、'),
        ];
        for (let i = 0; i < vals.length; i++) {
          const col = String.fromCharCode(65 + i);
          const cell = ws.getCell(`${col}${row}`);
          cell.value = vals[i];
          cell.font = normalFont;
          cell.alignment = { horizontal: i <= 2 || i === 10 ? 'left' : 'center', vertical: 'middle' };
          cell.border = {
            top: thinBorder,
            bottom: thinBorder,
            left: i === 0 ? medBorder : thinBorder,
            right: i === vals.length - 1 ? medBorder : thinBorder,
          };
        }
        // Saturday/Sunday coloring
        if (day.dayOfWeek === '土') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FF0066CC' } };
        } else if (day.dayOfWeek === '日') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FFCC0000' } };
        }
        row++;
      }

      // Total row
      const totalLabels = ['', '', '合計', totalDays, totalNights || null, totalOvertime || null, null, null, null, null, ''];
      for (let i = 0; i < totalLabels.length; i++) {
        const col = String.fromCharCode(65 + i);
        const cell = ws.getCell(`${col}${row}`);
        cell.value = totalLabels[i];
        cell.font = boldFont;
        cell.alignment = { horizontal: i <= 2 || i === 10 ? 'left' : 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.border = {
          top: medBorder,
          bottom: medBorder,
          left: i === 0 ? medBorder : thinBorder,
          right: i === totalLabels.length - 1 ? medBorder : thinBorder,
        };
      }
      ws.getRow(row).height = 22;

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name}_出面表_${selectedYear}年${selectedMonth}月.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
