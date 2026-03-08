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
    if (!selectedClientId) { alert('Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂÃ£ÂÂÃ©ÂÂ¸Ã¦ÂÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂ Ã£ÂÂÃ£ÂÂ'); return; }
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
      alert('Ã£ÂÂÃ£ÂÂ¼Ã£ÂÂ¿Ã¥ÂÂÃ¥Â¾ÂÃ£ÂÂ¨Ã£ÂÂ©Ã£ÂÂ¼: ' + error.message);
      setPreviewing(false);
      return;
    }

    const recs: AttendanceRecord[] = data || [];
    const dayMap = new Map<string, DailySummary>();
    let tDays = 0, tNights = 0, tOT = 0;

    for (const r of recs) {
      const workerName = r.employees?.name || 'Ã¤Â¸ÂÃ¦ÂÂ';
      const ot = r.overtime_hours || 0;
      const isNight = r.shift_type === 'night';
      const isDay = r.shift_type === 'day' || r.shift_type === 'trip_day';

      const existing = dayMap.get(r.date);
      if (existing) {
        if (isDay) existing.dayCount++;
        if (isNight) { existing.nightCount++; existing.nightInfo = `${existing.nightCount}`; }
        existing.overtimeHours += ot;
        if (!existing.workers.includes(workerName)) existing.workers.push(workerName);
        if (r.job_site && !existing.sites.includes(r.job_site)) existing.sites += 'Ã£ÂÂ' + r.job_site;
      } else {
        const d = new Date(r.date + 'T00:00:00');
        const days = ['Ã¦ÂÂ¥','Ã¦ÂÂ','Ã§ÂÂ«','Ã¦Â°Â´','Ã¦ÂÂ¨','Ã©ÂÂ','Ã¥ÂÂ'];
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

  function formatYen(n: number) { return 'ÃÂ¥' + n.toLocaleString(); }
  function formatDate(d: string) {
    const p = d.split('-');
    return `${parseInt(p[1])}/${parseInt(p[2])}`;
  }

  // Real company seal image (Ã¦Â ÂªÃ¥Â¼ÂÃ¤Â¼ÂÃ§Â¤Â¾Ã¦ÂÂ¬Ã¦ÂÂÃ¨ÂÂÃ¦Â¥Â­ Ã§Â¯ÂÃ¦ÂÂ¸Ã¤Â½ÂÃ¨Â§ÂÃ¥ÂÂ°)

  async function handleDownloadInvoice() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    setGenerating(true);

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`${selectedMonth}Ã¦ÂÂ`, {
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
      const periodStr = `${formatDate(startDate)}Ã¯Â½Â${formatDate(endDate)}`;
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
      titleCell.value = 'Ã¥Â¾Â¡ Ã¨Â«Â Ã¦Â±Â Ã¦ÂÂ¸';
      titleCell.font = { bold: true, size: 20, name: 'Yu Gothic' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 36;

      // Row 3: spacer
      ws.getRow(3).height = 6;

      // Row 4: Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂ¥ (right side)
      ws.mergeCells('E4:F4');
      ws.getCell('E4').value = `Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂ¥: ${selectedYear}Ã¥Â¹Â´${selectedMonth}Ã¦ÂÂ21Ã¦ÂÂ¥`;
      ws.getCell('E4').font = smallFont;
      ws.getCell('E4').alignment = { horizontal: 'right' };

      // Row 5: spacer
      ws.getRow(5).height = 6;

      // Row 6: Client name (left) / Company name (right)
      ws.mergeCells('A6:C6');
      const clientCell = ws.getCell('A6');
      clientCell.value = client.honorific_name || (client.name + ' Ã¥Â¾Â¡Ã¤Â¸Â­');
      clientCell.font = { bold: true, size: 13, name: 'Yu Gothic' };
      clientCell.border = { bottom: medBorder };

      ws.mergeCells('E6:F6');
      ws.getCell('E6').value = 'Ã¦Â ÂªÃ¥Â¼ÂÃ¤Â¼ÂÃ§Â¤Â¾Ã£ÂÂÃ¦ÂÂ¬Ã¦ÂÂÃ¨ÂÂÃ¦Â¥Â­';
      ws.getCell('E6').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('E6').alignment = { horizontal: 'right' };

      // Row 7: Client address / Postal code
      ws.mergeCells('A7:C7');
      ws.getCell('A7').value = client.address || '';
      ws.getCell('A7').font = smallFont;

      ws.mergeCells('E7:F7');
      ws.getCell('E7').value = 'Ã£ÂÂ606-8117';
      ws.getCell('E7').font = smallFont;
      ws.getCell('E7').alignment = { horizontal: 'right' };

      // Row 8: Company address
      ws.mergeCells('E8:F8');
      ws.getCell('E8').value = 'Ã¤ÂºÂ¬Ã©ÂÂ½Ã¥Â¸ÂÃ¥Â·Â¦Ã¤ÂºÂ¬Ã¥ÂÂºÃ¤Â¸ÂÃ¤Â¹ÂÃ¥Â¯ÂºÃ©ÂÂÃ£ÂÂ®Ã¥ÂÂÃ§ÂÂº85-14';
      ws.getCell('E8').font = smallFont;
      ws.getCell('E8').alignment = { horizontal: 'right' };

      // Row 9: TEL
      ws.mergeCells('A9:C9');
      ws.getCell('A9').value = 'Ã¤Â¸ÂÃ¨Â¨ÂÃ£ÂÂ®Ã©ÂÂÃ£ÂÂÃ£ÂÂÃ¨Â«ÂÃ¦Â±ÂÃ§ÂÂ³Ã£ÂÂÃ¤Â¸ÂÃ£ÂÂÃ£ÂÂ¾Ã£ÂÂÃ£ÂÂ';
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
      ws.getCell('A12').value = 'Ã£ÂÂÃ¨Â«ÂÃ¦Â±ÂÃ©ÂÂÃ©Â¡Â';
      ws.getCell('A12').font = { bold: true, size: 11, name: 'Yu Gothic' };
      ws.getCell('A12').alignment = { vertical: 'middle' };

      ws.mergeCells('C12:F12');
      ws.getCell('C12').value = grandTotal;
      ws.getCell('C12').numFmt = 'ÃÂ¥#,##0';
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

      // Row 14: Bank info + Ã§ÂÂ»Ã©ÂÂ²Ã§ÂÂªÃ¥ÂÂ·
      ws.mergeCells('A14:B14');
      ws.getCell('A14').value = 'Ã§ÂÂ»Ã©ÂÂ²Ã§ÂÂªÃ¥ÂÂ·: T5130001074190';
      ws.getCell('A14').font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF555555' } };

      ws.mergeCells('D14:F14');
      ws.getCell('D14').value = 'Ã£ÂÂÃ¦ÂÂ¯Ã¨Â¾Â¼Ã¥ÂÂ: Ã¤ÂºÂ¬Ã©ÂÂ½Ã¤Â¿Â¡Ã§ÂÂ¨Ã©ÂÂÃ¥ÂºÂ« Ã¤Â¿Â®Ã¥Â­Â¦Ã©ÂÂ¢Ã¦ÂÂ¯Ã¥ÂºÂ';
      ws.getCell('D14').font = smallFont;
      ws.getCell('D14').alignment = { horizontal: 'right' };

      // Row 15: Bank account + Ã¦ÂÂ¯Ã¨Â¾Â¼Ã¦ÂÂÃ¦ÂÂ¥
      ws.mergeCells('D15:F15');
      ws.getCell('D15').value = 'Ã¦ÂÂ®Ã©ÂÂ 3030674 Ã£ÂÂ«Ã¯Â¼ÂÃ£ÂÂ±Ã£ÂÂ¤Ã£ÂÂ¢Ã£ÂÂ¤Ã£ÂÂ³Ã£ÂÂ¦Ã£ÂÂ®Ã£ÂÂ§Ã£ÂÂ¦';
      ws.getCell('D15').font = smallFont;
      ws.getCell('D15').alignment = { horizontal: 'right' };

      ws.mergeCells('A15:B15');
      ws.getCell('A15').value = `Ã¦ÂÂ¯Ã¨Â¾Â¼Ã¦ÂÂÃ¦ÂÂ¥: ${selectedYear}Ã¥Â¹Â´${selectedMonth}Ã¦ÂÂÃ¦ÂÂ«`;
      ws.getCell('A15').font = boldFont;

      // Row 16: spacer
      ws.getRow(16).height = 6;

      // Row 17: Table header
      const headerRow = 17;
      const headers = [
        { col: 'A', val: 'Ã¦ÂÂ¥Ã¤Â»Â' },
        { col: 'B', val: 'Ã¥ÂÂÃ¥ÂÂÃ£ÂÂ»Ã¦ÂÂÃ¨Â¦Â' },
        { col: 'C', val: 'Ã¦ÂÂ°Ã©ÂÂ' },
        { col: 'D', val: 'Ã¥ÂÂÃ¤Â½Â' },
        { col: 'E', val: 'Ã¥ÂÂÃ¤Â¾Â¡' },
        { col: 'F', val: 'Ã©ÂÂÃ©Â¡Â' },
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
      lineItems.push({ name: 'Ã¨Â§Â£Ã¤Â½ÂÃ¤Â½ÂÃ¦Â¥Â­Ã¤Â»Â£Ã©ÂÂ', qty: totalDays, unit: 'Ã¤ÂºÂºÃ¦ÂÂ¥', price: dayRate, amount: dayAmount });
      if (totalOvertime > 0) {
        lineItems.push({ name: 'Ã¦Â®ÂÃ¦Â¥Â­Ã¤Â»Â£', qty: totalOvertime, unit: 'Ã¦ÂÂÃ©ÂÂ', price: otRate, amount: otAmount });
      }
      if (totalNights > 0) {
        lineItems.push({ name: 'Ã¥Â¤ÂÃ¥ÂÂ¤Ã¤Â»Â£Ã©ÂÂ', qty: totalNights, unit: 'Ã¤ÂºÂºÃ¦ÂÂ¥', price: client.night_rate || dayRate, amount: nightAmount });
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
      ws.getCell(`A${dataRow}`).value = 'Ã¥Â°ÂÃ¨Â¨Â';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = subtotal;
      ws.getCell(`F${dataRow}`).numFmt = 'ÃÂ¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'Ã¦Â¶ÂÃ¨Â²Â»Ã§Â¨Â (10%)';
      ws.getCell(`A${dataRow}`).font = boldFont;
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = tax;
      ws.getCell(`F${dataRow}`).numFmt = 'ÃÂ¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'Ã¥ÂÂÃ¨Â¨Â';
      ws.getCell(`A${dataRow}`).font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getCell(`A${dataRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(`E${dataRow}`).value = '';
      ws.getCell(`F${dataRow}`).value = grandTotal;
      ws.getCell(`F${dataRow}`).numFmt = 'ÃÂ¥#,##0';
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
      ws.getCell(`A${dataRow}`).value = 'Ã¥ÂÂÃ¨ÂÂ';
      ws.getCell(`A${dataRow}`).font = boldFont;
      dataRow++;
      ws.getCell(`A${dataRow}`).value = `Ã¦ÂÂÃ©ÂÂ: ${periodStr}`;
      ws.getCell(`A${dataRow}`).font = normalFont;
      dataRow++;
      ws.mergeCells(`A${dataRow}:F${dataRow}`);
      ws.getCell(`A${dataRow}`).value = 'Ã£ÂÂÃ£ÂÂ®Ã¥Â£Â²Ã£ÂÂÃ¤Â¸ÂÃ£ÂÂÃ£ÂÂ®10Ã¯Â¼ÂÃ£ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂÃ¥Â­ÂÃ£ÂÂ©Ã£ÂÂÃ©Â£ÂÃ¥Â ÂÃ£ÂÂ¨Ã£ÂÂ±Ã£ÂÂ¤Ã£ÂÂ¢Ã£ÂÂ¤Ã£ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂ¹Ã¤Â¾Â¿Ã¯Â¼ÂÃ©ÂÂÃ¥ÂÂ¶Ã¥ÂÂ©Ã¥ÂÂ£Ã¤Â½ÂÃ¯Â¼ÂÃ£ÂÂ«Ã¥Â¯ÂÃ¤Â»ÂÃ£ÂÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂÃ£ÂÂ Ã£ÂÂÃ£ÂÂ¾Ã£ÂÂÃ£ÂÂ';
      ws.getCell(`A${dataRow}`).font = { size: 8, name: 'Yu Gothic', color: { argb: 'FF666666' } };


      // Download
      const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name}_Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂ¸_${selectedYear}Ã¥Â¹Â´${selectedMonth}Ã¦ÂÂ.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Ã£ÂÂ¨Ã£ÂÂ©Ã£ÂÂ¼: ' + (err as Error).message);
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
      const ws = workbook.addWorksheet(`Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨_${selectedMonth}Ã¦ÂÂ`, {
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
      ws.getCell('A1').value = 'Ã¥ÂÂº Ã©ÂÂ¢ Ã¨Â¡Â¨';
      ws.getCell('A1').font = { bold: true, size: 18, name: 'Yu Gothic' };
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Subtitle
      ws.mergeCells('A2:C2');
      ws.getCell('A2').value = `${selectedYear}Ã¥Â¹Â´${selectedMonth}Ã¦ÂÂÃ¥ÂÂÃ£ÂÂ${client.name}`;
      ws.getCell('A2').font = { bold: true, size: 12, name: 'Yu Gothic' };
      ws.getRow(2).height = 24;

      // Header row
      const hdrRow = 3;
      const hdrLabels = ['Ã¦ÂÂ¥Ã¤Â»Â','Ã¦ÂÂÃ¦ÂÂ¥','Ã§ÂÂ¾Ã¥Â Â´','Ã¦ÂÂ¥Ã¥ÂÂ¤','Ã¥Â¤ÂÃ¥ÂÂ¤','Ã¦Â®ÂÃ¦Â¥Â­','Ã¦ÂÂ©Ã¥ÂÂº','Ã¥ÂÂÃ¥Â·Â¥','Ã¨Â§Â£Ã¤Â½ÂÃ¥Â·Â¥','Ã©ÂÂÃ¨Â¿Â','Ã¥ÂÂÃ¨ÂÂ'];
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
          day.workers.join('Ã£ÂÂ'),
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
        if (day.dayOfWeek === 'Ã¥ÂÂ') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FF0066CC' } };
        } else if (day.dayOfWeek === 'Ã¦ÂÂ¥') {
          ws.getCell(`B${row}`).font = { ...normalFont, color: { argb: 'FFCC0000' } };
        }
        row++;
      }

      // Total row
      const totalLabels = ['', '', 'Ã¥ÂÂÃ¨Â¨Â', totalDays, totalNights || null, totalOvertime || null, null, null, null, null, ''];
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
      a.download = `${client.name}_Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨_${selectedYear}Ã¥Â¹Â´${selectedMonth}Ã¦ÂÂ.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Ã£ÂÂ¨Ã£ÂÂ©Ã£ÂÂ¼: ' + (err as Error).message);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Ã¨ÂªÂ­Ã£ÂÂ¿Ã¨Â¾Â¼Ã£ÂÂ¿Ã¤Â¸Â­...</div>
      </div>
    );
  }

  const client = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂ¸Ã£ÂÂ»Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨</h1>
          <a href="/admin" className="text-gray-300 hover:text-white text-sm">Ã¢ÂÂ Ã§Â®Â¡Ã§ÂÂÃ§ÂÂ»Ã©ÂÂ¢</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* Ã©ÂÂ¸Ã¦ÂÂÃ£ÂÂ¨Ã£ÂÂªÃ£ÂÂ¢ */}
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂ</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Ã©ÂÂ¸Ã¦ÂÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂ Ã£ÂÂÃ£ÂÂ</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Ã¥Â¹Â´</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}Ã¥Â¹Â´</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Ã¦ÂÂ</label>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(Number(e.target.value)); setHasFetched(false); setDailySummary([]); }}
                className="w-full border rounded-lg px-3 py-2"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}Ã¦ÂÂ</option>
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
              {previewing ? 'Ã©ÂÂÃ¨Â¨ÂÃ¤Â¸Â­...' : 'Ã©ÂÂÃ¨Â¨ÂÃ£ÂÂ»Ã£ÂÂÃ£ÂÂ¬Ã£ÂÂÃ£ÂÂ¥Ã£ÂÂ¼'}
            </button>
          </div>
        </div>

        {/* Ã£ÂÂÃ£ÂÂ¬Ã£ÂÂÃ£ÂÂ¥Ã£ÂÂ¼Ã¨Â¡Â¨Ã§Â¤Âº */}
        {dailySummary.length > 0 && client && (
          <>
            {/* Ã¨Â«ÂÃ¦Â±ÂÃ£ÂÂµÃ£ÂÂÃ£ÂÂªÃ£ÂÂ¼ */}
            <div className="bg-white rounded-xl shadow p-5 mb-4">
              <h2 className="font-bold text-lg mb-3">Ã¨Â«ÂÃ¦Â±ÂÃ£ÂÂµÃ£ÂÂÃ£ÂÂªÃ£ÂÂ¼</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂ:</div>
                  <div className="font-bold">{client.name}</div>
                  <div className="text-gray-600">Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂÃ©ÂÂ:</div>
                  <div className="font-bold">
                    {(() => {
                      const { startDate, endDate } = getBillingPeriod(selectedYear, selectedMonth, client);
                      return `${formatDate(startDate)} Ã¯Â½Â ${formatDate(endDate)}`;
                    })()}
                  </div>
                  <div className="text-gray-600">Ã¨Â§Â£Ã¤Â½ÂÃ¤Â½ÂÃ¦Â¥Â­Ã¤Â»Â£Ã©ÂÂ:</div>
                  <div className="font-bold">
                    {totalDays}Ã¤ÂºÂºÃ¦ÂÂ¥ ÃÂ {formatYen(client.day_rate)} = {formatYen(totalDays * client.day_rate)}
                  </div>
                  {totalNights > 0 && (
                    <>
                      <div className="text-gray-600">Ã¥Â¤ÂÃ¥ÂÂ¤Ã¤Â»Â£Ã©ÂÂ:</div>
                      <div className="font-bold">
                        {totalNights}Ã¤ÂºÂºÃ¦ÂÂ¥ ÃÂ {formatYen(client.night_rate)} = {formatYen(totalNights * client.night_rate)}
                      </div>
                    </>
                  )}
                  {totalOvertime > 0 && (
                    <>
                      <div className="text-gray-600">Ã¦Â®ÂÃ¦Â¥Â­Ã¤Â»Â£:</div>
                      <div className="font-bold">
                        {totalOvertime}h ÃÂ {formatYen(client.overtime_rate || 2300)} = {formatYen(totalOvertime * (client.overtime_rate || 2300))}
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
                        <div className="text-gray-600">Ã¥Â°ÂÃ¨Â¨Â:</div>
                        <div className="font-bold">{formatYen(sub)}</div>
                        <div className="text-gray-600">Ã¦Â¶ÂÃ¨Â²Â»Ã§Â¨Â (10%):</div>
                        <div className="font-bold">{formatYen(t)}</div>
                      </div>
                      <div className="border-t mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">Ã¨Â«ÂÃ¦Â±ÂÃ©ÂÂÃ©Â¡ÂÃ¥ÂÂÃ¨Â¨Â</span>
                          <span className="font-bold text-2xl text-green-700">{formatYen(sub + t)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨Ã£ÂÂÃ£ÂÂ¬Ã£ÂÂÃ£ÂÂ¥Ã£ÂÂ¼ */}
            <div className="bg-white rounded-xl shadow p-5 mb-4 overflow-x-auto">
              <h2 className="font-bold text-lg mb-3">Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨Ã£ÂÂÃ£ÂÂ¬Ã£ÂÂÃ£ÂÂ¥Ã£ÂÂ¼</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">Ã¦ÂÂ¥Ã¤Â»Â</th>
                    <th className="border px-2 py-1">Ã¦ÂÂ</th>
                    <th className="border px-2 py-1 text-left">Ã§ÂÂ¾Ã¥Â Â´</th>
                    <th className="border px-2 py-1">Ã¦ÂÂ¥Ã¥ÂÂ¤</th>
                    <th className="border px-2 py-1">Ã¥Â¤ÂÃ¥ÂÂ¤</th>
                    <th className="border px-2 py-1">Ã¦Â®ÂÃ¦Â¥Â­</th>
                    <th className="border px-2 py-1 text-left">Ã¤Â½ÂÃ¦Â¥Â­Ã¥ÂÂ¡</th>
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
                      <td className="border px-2 py-1">{day.workers.join('Ã£ÂÂ')}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border px-2 py-1" colSpan={3}>Ã¥ÂÂÃ¨Â¨Â</td>
                    <td className="border px-2 py-1 text-center">{totalDays}</td>
                    <td className="border px-2 py-1 text-center">{totalNights || ''}</td>
                    <td className="border px-2 py-1 text-center">{totalOvertime || ''}</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Ã£ÂÂÃ£ÂÂ¦Ã£ÂÂ³Ã£ÂÂ­Ã£ÂÂ¼Ã£ÂÂÃ£ÂÂÃ£ÂÂ¿Ã£ÂÂ³ */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={handleDownloadInvoice}
                disabled={generating}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow"
              >
                {generating ? 'Ã§ÂÂÃ¦ÂÂÃ¤Â¸Â­...' : 'Ã¨Â«ÂÃ¦Â±ÂÃ¦ÂÂ¸Ã£ÂÂÃ£ÂÂ¦Ã£ÂÂ³Ã£ÂÂ­Ã£ÂÂ¼Ã£ÂÂ'}
              </button>
              <button
                onClick={handleDownloadDemenpyo}
                disabled={generating}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 shadow"
              >
                {generating ? 'Ã§ÂÂÃ¦ÂÂÃ¤Â¸Â­...' : 'Ã¥ÂÂºÃ©ÂÂ¢Ã¨Â¡Â¨Ã£ÂÂÃ£ÂÂ¦Ã£ÂÂ³Ã£ÂÂ­Ã£ÂÂ¼Ã£ÂÂ'}
              </button>
            </div>
          </>
        )}

        {hasFetched && dailySummary.length === 0 && !previewing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
            <p className="font-bold mb-2">Ã¨Â©Â²Ã¥Â½ÂÃ£ÂÂÃ£ÂÂ¼Ã£ÂÂ¿Ã£ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂ¾Ã£ÂÂÃ£ÂÂ</p>
            <p>Ã¨ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂÃ£ÂÂÃ¥ÂÂÃ¥ÂÂ :</p>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Ã¥ÂÂºÃ¥ÂÂ¤Ã¨Â¨ÂÃ©ÂÂ²Ã£ÂÂ«Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂÃ¯Â¼Âclient_idÃ¯Â¼ÂÃ£ÂÂÃ§Â´ÂÃ£ÂÂ¥Ã£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂªÃ£ÂÂ</li>
              <li>Ã©ÂÂ¸Ã¦ÂÂÃ£ÂÂÃ£ÂÂÃ¦ÂÂÃ©ÂÂÃ£ÂÂ«Ã¥ÂÂºÃ¥ÂÂ¤Ã£ÂÂÃ£ÂÂ¼Ã£ÂÂ¿Ã£ÂÂÃ£ÂÂªÃ£ÂÂ</li>
              <li>Ã¥ÂÂºÃ¥ÂÂ¤Ã¨Â¨ÂÃ©ÂÂ²Ã£ÂÂÃ¤Â¼ÂÃ¦ÂÂ¥Ã¯Â¼Âis_holidayÃ¯Â¼ÂÃ£ÂÂ«Ã¨Â¨Â­Ã¥Â®ÂÃ£ÂÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂ</li>
            </ul>
            <p className="mt-2">Ã¥ÂÂºÃ¥ÂÂ¤Ã¨Â¨ÂÃ©ÂÂ²Ã§ÂÂ»Ã©ÂÂ¢Ã£ÂÂ§Ã¥ÂÂÃ¨Â¨ÂÃ©ÂÂ²Ã£ÂÂ«Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂÃ£ÂÂÃ¨Â¨Â­Ã¥Â®ÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂ Ã£ÂÂÃ£ÂÂÃ£ÂÂ</p>
          </div>
        )}

        {!selectedClientId && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            Ã¥ÂÂÃ¥Â¼ÂÃ¥ÂÂÃ£ÂÂ¨Ã¦ÂÂÃ£ÂÂÃ©ÂÂ¸Ã¦ÂÂÃ£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ©ÂÂÃ¨Â¨ÂÃ£ÂÂ»Ã£ÂÂÃ£ÂÂ¬Ã£ÂÂÃ£ÂÂ¥Ã£ÂÂ¼Ã£ÂÂÃ£ÂÂÃ¦ÂÂ¼Ã£ÂÂÃ£ÂÂ¦Ã£ÂÂÃ£ÂÂ Ã£ÂÂÃ£ÂÂ
          </div>
        )}
      </main>
    </div>
  );
}
