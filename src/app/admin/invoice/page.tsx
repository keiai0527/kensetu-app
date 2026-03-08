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
  employee_id: string
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
    if (!selectedClientId) { alert('åå¼åãé¸æãã¦ãã ãã'); return; }
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
      alert('ãã¼ã¿åå¾ã¨ã©ã¼: ' + error.message);
      setPreviewing(false);
      return;
    }

    const recs: AttendanceRecord[] = data || [];
    const dayMap = new Map<string, DailySummary>();
    let tDays = 0, tNights = 0, tOT = 0;

    for (const r of recs) {
      const workerName = r.employees?.name || 'ä¸æ';
      const ot = r.overtime_hours || 0;
      const isNight = r.shift_type === 'night';
      const isDay = r.shift_type === 'day' || r.shift_type === 'trip_day';

      const existing = dayMap.get(r.date);
      if (existing) {
        if (isDay) existing.dayCount++;
        if (isNight) { existing.nightCount++; existing.nightInfo = `${existing.nightCount}`; }
        existing.overtimeHours += ot;
        if (!existing.workers.includes(workerName)) existing.workers.push(workerName);
        if (r.job_site && !existing.sites.includes(r.job_site)) existing.sites += 'ã' + r.job_site;
      } else {
        const d = new Date(r.date + 'T00:00:00');
        const days = ['æ¥','æ','ç«','æ°´','æ¨','é','å'];
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

  function formatYen(n: number) { return 'Â¥' + n.toLocaleString(); }
  function formatDate(d: string) {
    const p = d.split('-');
    return `${parseInt(p[1])}/${parseInt(p[2])}`;
  }

  // Real company seal image (æ ªå¼ä¼ç¤¾æ¬æèæ¥­ ç¯æ¸ä½è§å°)
  const SEAL_BASE64 = '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';

  async function handleDownloadInvoice() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    setGenerating(true);

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`${selectedMonth}æ`, {
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
      const periodStr = `${formatDate(startDate)}ï½${formatDate(endDate)}`;
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
      titleCell.value = 'å¾¡ è« æ± æ¸';
      titleCell.font = { bold: true, size: 20, name: 'Yu Gothic' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 36;

      // Row 3: spacer
      ws.getRow(3).height = 6;

      // Row 4: è«æ±æ¥ (right side)
      ws.mergeCells('E4:F4');
      ws.getCell('E4').value = `è«æ±æ¥: ${selectedYear}å¹´${selectedMonth}æ21æ¥`;
      ws.getCell('E4').font = smallFont;
      ws.getCell('E4').alignment = { horizontal: 'right' };

      // Row 5: spacer
      ws.getRow(5).height = 6;

      // Row 6: Client name (left) / Company name (right)
      ws.mergeCells('A6:C6');
      const clientCell = ws.getCell('A6');
      clientCell.value = client.honorific_name || (client.name + ' å¾¡ä¸­');
      clientCell.font = { bold: true, size: 13, name: 'Yu Gothic' };
      clientCell.border = { bottom: medBorder };

      ws.mergeCells('E6:F6');
      ws.getCell('E6').value = 'æ ªå¼ä¼ç¤¾ãæ¬æèæ¥­';
      ws.getCell('E6').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('E6').alignment = { horizontal: 'right' };

      // Row 7: Client address / Postal code
      ws.mergeCells('A7:C7');
      ws.getCell('A7').value = client.address || '';
      ws.getCell('A7').font = smallFont;

      ws.mergeCells('E7:F7');
      ws.getCell('E7').value = 'ã606-8117';
      ws.getCell('E7').font = smallFont;
      ws.getCell('E7').alignment = { horizontal: 'right' };

      // Row 8: Company address
      ws.mergeCells('E8:F8');
      ws.getCell('E8').value = 'äº¬é½å¸å·¦äº¬åºä¸ä¹å¯ºéã®åçº85-14';
      ws.getCell('E8').font = smallFont;
      ws.getCell('E8').alignment = { horizontal: 'right' };

      // Row 9: TEL
      ws.mergeCells('A9:C9');
      ws.getCell('A9').value = 'ä¸è¨ã®éããè«æ±ç³ãä¸ãã¾ãã';
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
      ws.getCell('A12').value = 'ãè«æ±éé¡';
      ws.getCell('A12').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('A12').alignment = { vertical: 'middle' };

      ws.mergeCells('C12:F12');
      ws.getCell('C12').value = grandTotal;
      ws.getCell('C12').numFmt = 'Â¥#,##0';
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

      // Row 14: Bank info + ç»é²çªå·
      ws.mergeCells('A14:B14');
      ws.getCell('A14').value = 'ç»é²çªå·: T5130001074190';
      ws.getCell('A14').font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF555555' } };

      ws.mergeCells('D14:F14');
      ws.getCell('D14').value = 'ãæ¯è¾¼å: äº¬é½ä¿¡ç¨éåº« ä¿®å­¦é¢æ¯åº';
      ws.getCell('D14').font = smallFont;
      ws.getCell('D14').alignment = { horizontal: 'right' };

      // Row 15: Bank account + æ¯è¾¼ææ¥
      ws.mergeCells('D15:F15');
      ws.getCell('D15').value = 'æ®é 3030674 ã«ï¼ã±ã¤ã¢ã¤ã³ã¦ã®ã§ã¦';
      ws.getCell('D15').font = smallFont;
      ws.getCell('D15').alignment = { horizontal: 'right' };

      ws.mergeCells('A15:B15');
      ws.getCell('A15').value = `æ¯è¾¼ææ¥: ${selectedYear}å¹´${selectedMonth}ææ«`;
      ws.getCell('A15').font = boldFont;

      // Row 16: spacer
      ws.getRow(16).height = 6;

      // Row 17: Table header
      const headerRow = 17;
      const headers = [
        { col: 'A', val: 'æ¥ä»' },
        { col: 'B', val: 'ååã»æè¦' },
        { col: 'C', val: 'æ°é' },
        { col: 'D', val: 'åä½' },
        { col: 'E', val: 'åä¾¡' },
        { col: 'F', val: 'éé¡' },
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
      lineItems.push({ name: 'è§£ä½ä½æ¥­ä»£é', qty: totalDays, unit: 'äººæ¥', price: dayRate, amount: dayAmount });
      if (totalOvertime > 0) {
        lineItems.push({ name: 'æ®æ¥­ä»£', qty: totalOvertime, unit: 'æé', price: otRate, amount: otAmount });
      }
      if (totalNights > 0) {
        lineItems.push({ name: 'å¤å¤ä»£é', qty: totalNights, unit: 'äººæ¥', price: client.night_rate || dayRate, amount: nightAmount });
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
      ws.getCell(`A${dataRow}`).value = 'å°è¨';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = subtotal;
      ws.getCell(`F${dataRow}`).numFmt = 'Â¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'æ¶è²»ç¨ (10%)';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = tax;
      ws.getCell(`F${dataRow}`).numFmt = 'Â¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'åè¨';
      ws.getCell(`A${dataRow}`).font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = grandTotal;
      ws.getCell(`F${dataRow}`).numFmt = 'Â¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'åè';
      ws.getCell(`A${dataRow}`).font = boldFont;
      dataRow++;
      ws.getCell(`A${dataRow}`).value = `æé: ${periodStr}`;
      ws.getCell(`A${dataRow}`).font = normalFont;
      dataRow++;
      ws.mergeCells(`A${dataRow}:F${dataRow}`);
      ws.getCell(`A${dataRow}`).value = 'ãã®å£²ãä¸ãã®10ï¼ãããããå­ã©ãé£å ã¨ã±ã¤ã¢ã¤ãããã¹ä¾¿ï¼éå¶å©å£ä½ï¼ã«å¯ä»ããã¦ããã ãã¾ãã';
      ws.getCell(`A${dataRow}`).font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF666666' } };

      // Electronic seal image (positioned near company address area)
      try {
      const imageId = workbook.addImage({ base64: `data:image/png;base64,${SEAL_BASE64.trim()}`, extension: 'png' });
        ws.addImage(imageId, {
          tl: { col: 4, row: 5 } as any,
        ext: { width: 150, height: 150 },
        });
      } catch (e) {
        console.warn('Seal image creation failed:', e);
      }

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name}_è«æ±æ¸_${selectedYear}å¹´${selectedMonth}æ.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('ã¨ã©ã¼: ' + (err as Error).message);
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
      const ws = workbook.addWorksheet(`åºé¢è¡¨_${selectedMonth}æ`, {
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
      ws.getCell('A1').value = 'åº é¢ è¡¨';
      ws.getCell('A1').font = { bold: true, size: 18, name: 'Yu Gothic' };
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Subtitle
      ws.mergeCells('A2:C2');
      ws.getCell('A2').value = `${selectedYear}å¹´${selectedMonth}æåã${client.name}`;
      ws.getCell('A2').font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getRow(2).height = 24;

      // Header row
      const hdrRow = 3;
      const hdrLabels = ['æ¥ä»','ææ¥','ç¾å ´','æ¥å¤','å¤å¤','æ®æ¥­','æ©åº','åå·¥','è§£ä½å·¥','éè¿','åè'];
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
          day.workers.join('ã'),
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
        if (day.dayOfWeek === 'å') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FF0066CC' } };
        } else if (day.dayOfWeek === 'æ¥') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FFCC0000' } };
        }
        row++;
      }

      // Total row
      const totalLabels = ['', '', 'åè¨', totalDays, totalNights || null, totalOvertime || null, null, null, null, null, ''];
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
      a.download = `${client.name}_åºé¢è¡¨_${selectedYear}å¹´${selectedMonth}æ.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('ã¨ã©ã¼: ' + (err as Error).message);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">èª­ã¿è¾¼ã¿ä¸­...</div>
      </div>
    );
  }

  const client = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">è«æ±æ¸ã»åºé¢è¡¨</h1>
          <a href="/admin" className="text-gray-300 hover:text-white text-sm">â ç®¡çç»é¢</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* é¸æã¨ãªã¢ */}
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">åå¼å</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">é¸æãã¦ãã ãã</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">å¹´</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}å¹´</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">æ</label>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}æ</option>
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
              {previewing ? 'éè¨ä¸­...' : 'éè¨ã»ãã¬ãã¥ã¼'}
            </button>
          </div>
        </div>

        {/* ãã¬ãã¥ã¼è¡¨ç¤º */}
        {dailySummary.length > 0 && client && (
          <>
            {/* è«æ±ãµããªã¼ */}
            <div className="bg-white rounded-xl shadow p-5 mb-4">
              <h2 className="font-bold text-lg mb-3">è«æ±ãµããªã¼</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">åå¼å:</div>
                  <div className="font-bold">{client.name}</div>
                  <div className="text-gray-600">è«æ±æé:</div>
                  <div className="font-bold">
                    {(() => {
                      const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);
                      return `${formatDate(startDate)} ï½ ${formatDate(endDate)}`;
                    })()}
                  </div>
                  <div className="text-gray-600">è§£ä½ä½æ¥­ä»£é:</div>
                  <div className="font-bold">
                    {totalDays}äººæ¥ Ã {formatYen(client.day_rate)} = {formatYen(totalDays * client.day_rate)}
                  </div>
                  {totalNights > 0 && (
                    <>
                      <div className="text-gray-600">å¤å¤ä»£é:</div>
                      <div className="font-bold">
                        {totalNights}äººæ¥ Ã {formatYen(client.night_rate)} = {formatYen(totalNights * client.night_rate)}
                      </div>
                    </>
                  )}
                  {totalOvertime > 0 && (
                    <>
                      <div className="text-gray-600">æ®æ¥­ä»£:</div>
                      <div className="font-bold">
                        {totalOvertime}h Ã {formatYen(client.overtime_rate || 2300)} = {formatYen(totalOvertime * (client.overtime_rate || 2300))}
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
                        <div className="text-gray-600">å°è¨:</div>
                        <div className="font-bold">{formatYen(sub)}</div>
                        <div className="text-gray-600">æ¶è²»ç¨ (10%):</div>
                        <div className="font-bold">{formatYen(t)}</div>
                      </div>
                      <div className="border-t mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">è«æ±éé¡åè¨</span>
                          <span className="font-bold text-2xl text-green-700">{formatYen(sub + t)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* åºé¢è¡¨ãã¬ãã¥ã¼ */}
            <div className="bg-white rounded-xl shadow p-5 mb-4 overflow-x-auto">
              <h2 className="font-bold text-lg mb-3">åºé¢è¡¨ãã¬ãã¥ã¼</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">æ¥ä»</th>
                    <th className="border px-2 py-1">æ</th>
                    <th className="border px-2 py-1 text-left">ç¾å ´</th>
                    <th className="border px-2 py-1">æ¥å¤</th>
                    <th className="border px-2 py-1">å¤å¤</th>
                    <th className="border px-2 py-1">æ®æ¥­</th>
                    <th className="border px-2 py-1 text-left">ä½æ¥­å¡</th>
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
                      <td className="border px-2 py-1">{day.workers.join('ã')}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border px-2 py-1" colSpan={3}>åè¨</td>
                    <td className="border px-2 py-1 text-center">{totalDays}</td>
                    <td className="border px-2 py-1 text-center">{totalNights || ''}</td>
                    <td className="border px-2 py-1 text-center">{totalOvertime || ''}</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ãã¦ã³ã­ã¼ããã¿ã³ */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={handleDownloadInvoice}
                disabled={generating}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow"
              >
                {generating ? 'çæä¸­...' : 'è«æ±æ¸ãã¦ã³ã­ã¼ã'}
              </button>
              <button
                onClick={handleDownloadDemenpyo}
                disabled={generating}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 shadow"
              >
                {generating ? 'çæä¸­...' : 'åºé¢è¡¨ãã¦ã³ã­ã¼ã'}
              </button>
            </div>
          </>
        )}

        {hasFetched && dailySummary.length === 0 && !previewing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
            <p className="font-bold mb-2">è©²å½ãã¼ã¿ãããã¾ãã</p>
            <p>èããããåå :</p>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>åºå¤è¨é²ã«åå¼åï¼client_idï¼ãç´ã¥ãã¦ããªã</li>
              <li>é¸æããæéã«åºå¤ãã¼ã¿ããªã</li>
              <li>åºå¤è¨é²ãä¼æ¥ï¼is_holidayï¼ã«è¨­å®ããã¦ãã</li>
            </ul>
            <p className="mt-2">åºå¤è¨é²ç»é¢ã§åè¨é²ã«åå¼åãè¨­å®ãã¦ãã ããã</p>
          </div>
        )}

        {!selectedClientId && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            åå¼åã¨æãé¸æãã¦ãéè¨ã»ãã¬ãã¥ã¼ããæ¼ãã¦ãã ãã
          </div>
        )}
      </main>
    </div>
  );
}
