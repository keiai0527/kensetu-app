'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Pencil } from 'lucide-react';

type Client = {
  id: string;
  name: string;
  has_night_shift: boolean;
  has_trip: boolean;
};

type AttendanceRecord = {
  id: string;
  date: string;
  client_id: string;
  site_name: string;
  shift_type: string;
  has_overtime: boolean;
  overtime_hours: number;
  is_holiday: boolean;
  note: string;
  clients: { name: string } | null;
};

const SHIFT_LABELS: Record<string, string> = {
  day: '日勤',
  night: '夜勤',
  trip_day: '出張日勤',
  trip_night: '出張夜勤',
};

export default function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');

  // 編集用state
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [editDate, setEditDate] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editSiteName, setEditSiteName] = useState('');
  const [editShiftType, setEditShiftType] = useState('day');
  const [editHasOvertime, setEditHasOvertime] = useState(false);
  const [editOvertimeHours, setEditOvertimeHours] = useState('');
  const [editIsHoliday, setEditIsHoliday] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem('employee_id');
    const name = sessionStorage.getItem('employee_name');
    if (!id || !name) {
      window.location.href = '/';
      return;
    }
    setEmployeeId(id);
    setEmployeeName(name);

    // 今月をデフォルト
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonth(m);

    fetchRecords(id, m);
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, has_night_shift, has_trip')
      .eq('is_active', true)
      .order('display_order');
    if (data) setClients(data);
  }

  async function fetchRecords(empId: string, monthStr: string) {
    setLoading(true);
    const [year, mon] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data } = await supabase
      .from('attendance')
      .select('id, date, client_id, site_name, shift_type, has_overtime, overtime_hours, is_holiday, note, clients(name)')
      .eq('employee_id', empId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });

    if (data) setRecords(data as unknown as AttendanceRecord[]);
    setLoading(false);
  }

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchRecords(employeeId, m);
  }

  function openEdit(record: AttendanceRecord) {
    setEditRecord(record);
    setEditDate(record.date);
    setEditClientId(record.client_id || '');
    setEditSiteName(record.site_name || '');
    setEditShiftType(record.shift_type || 'day');
    setEditHasOvertime(record.has_overtime);
    setEditOvertimeHours(record.overtime_hours ? String(record.overtime_hours) : '');
    setEditIsHoliday(record.is_holiday);
    setEditNote(record.note || '');
    const client = clients.find(c => c.id === record.client_id) || null;
    setSelectedClient(client);
  }

  function closeEdit() {
    setEditRecord(null);
  }

  function handleEditClientChange(id: string) {
    setEditClientId(id);
    const client = clients.find(c => c.id === id) || null;
    setSelectedClient(client);
    setEditShiftType('day');
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRecord) return;

    setEditSubmitting(true);

    const { error } = await supabase
      .from('attendance')
      .update({
        date: editDate,
        client_id: editClientId || null,
        site_name: editSiteName,
        shift_type: editIsHoliday ? 'day' : editShiftType,
        has_overtime: editHasOvertime,
        overtime_hours: editHasOvertime ? parseFloat(editOvertimeHours) || 0 : 0,
        is_holiday: editIsHoliday,
        note: editNote,
      })
      .eq('id', editRecord.id);

    setEditSubmitting(false);

    if (error) {
      alert('エラーが発生しました / Đã xảy ra lỗi: ' + error.message);
    } else {
      setEditRecord(null);
      setShowEditSuccess(true);
      setTimeout(() => setShowEditSuccess(false), 2000);
      fetchRecords(employeeId, month);
    }
  }

  const workDays = records.filter(r => !r.is_holiday).length;
  const holidays = records.filter(r => r.is_holiday).length;

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-blue-800 text-white p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <a href="/" className="text-blue-200 hover:text-white">&larr; 戻る</a>
          <h1 className="text-lg font-bold">入力履歴</h1>
          <span className="text-blue-200 text-sm">{employeeName}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {showEditSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
            <div className="bg-white rounded-3xl p-10 mx-4 text-center shadow-2xl max-w-xs w-full">
              <div className="mb-5 flex justify-center">
                <img src="/icons/icon-success.png" alt="" className="h-28 w-28 object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">修正しました！</h2>
              <p className="text-sm text-gray-400">Đã cập nhật!</p>
            </div>
          </div>
        )}

        {/* 月選択 */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <input
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-4 mt-3 text-sm text-gray-600">
            <span>出勤: <strong className="text-blue-700">{workDays}日</strong></span>
            <span>休み: <strong className="text-gray-500">{holidays}日</strong></span>
          </div>
        </div>

        {/* 記録一覧 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            この月の記録はありません<br/>
            <span className="text-sm">Không có dữ liệu trong tháng này</span>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <div
                key={record.id}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  record.is_holiday ? 'border-l-4 border-gray-400' : 'border-l-4 border-blue-500'
                }`}
                onClick={() => openEdit(record)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-800">
                    {new Date(record.date + 'T00:00:00').toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {record.is_holiday ? (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-bold">
                        休み
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        record.shift_type === 'night' || record.shift_type === 'trip_night'
                          ? 'bg-purple-100 text-purple-700'
                          : record.shift_type.startsWith('trip')
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {SHIFT_LABELS[record.shift_type]}
                      </span>
                    )}
                    <Pencil className="h-4 w-4 text-blue-400" strokeWidth={2} aria-label="編集" />
                  </div>
                </div>
                {!record.is_holiday && (
                  <>
                    <div className="text-sm text-gray-600">
                      {record.clients?.name}
                      {record.site_name && ` - ${record.site_name}`}
                    </div>
                    {record.has_overtime && (
                      <div className="text-sm text-orange-600 font-bold mt-1">
                        残業 {record.overtime_hours}時間
                      </div>
                    )}
                  </>
                )}
                {record.note && (
                  <div className="text-xs text-gray-500 mt-1">{record.note}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-2">
          タップして修正 / Nhấn để sửa
        </p>

        <div className="mt-6 text-center">
          <a href="/attendance" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold inline-block hover:bg-blue-700">
            出勤を入力する / Nhập chấm công
          </a>
        </div>
      </main>

      {/* 編集モーダル */}
      {editRecord && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-end sm:items-center justify-center">
          <div className="bg-blue-50 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <div className="bg-blue-800 text-white p-4 rounded-t-2xl sm:rounded-t-2xl flex items-center justify-between">
              <button onClick={closeEdit} className="text-blue-200 hover:text-white font-bold">
                ✕ 閉じる
              </button>
              <h2 className="text-lg font-bold">記録を修正</h2>
              <span className="text-blue-200 text-sm">Sửa</span>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              {/* 日付 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  日付 / Ngày <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* 休み切替 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsHoliday}
                    onChange={(e) => setEditIsHoliday(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-bold text-gray-700">
                    休み（作業なし）/ Nghỉ
                  </span>
                </label>
              </div>

              {!editIsHoliday && (
                <>
                  {/* 取引先 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      取引先 / Đối tác <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editClientId}
                      onChange={(e) => handleEditClientChange(e.target.value)}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">-- 選択 / Chọn --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 現場名 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      現場名 / Tên công trường
                    </label>
                    <input
                      type="text"
                      value={editSiteName}
                      onChange={(e) => setEditSiteName(e.target.value)}
                      placeholder="例: 渋谷マンション新築工事"
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* 勤務タイプ */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      勤務タイプ / Loại ca làm <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditShiftType('day')}
                        className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                          editShiftType === 'day'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-600'
                        }`}
                      >
                        日勤<br/><span className="text-xs">Ca ngày</span>
                      </button>
                      {selectedClient?.has_night_shift && (
                        <button
                          type="button"
                          onClick={() => setEditShiftType('night')}
                          className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                            editShiftType === 'night'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          夜勤<br/><span className="text-xs">Ca đêm</span>
                        </button>
                      )}
                      {selectedClient?.has_trip && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditShiftType('trip_day')}
                            className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                              editShiftType === 'trip_day'
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            出張日勤<br/><span className="text-xs">Đi công tác ngày</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShiftType('trip_night')}
                            className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                              editShiftType === 'trip_night'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            出張夜勤<br/><span className="text-xs">Đi công tác đêm</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 残業 */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={editHasOvertime}
                        onChange={(e) => setEditHasOvertime(e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span className="font-bold text-gray-700">
                        残業あり / Làm thêm giờ
                      </span>
                    </label>
                    {editHasOvertime && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editOvertimeHours}
                          onChange={(e) => setEditOvertimeHours(e.target.value)}
                          step="0.5"
                          min="0.5"
                          max="12"
                          placeholder="時間"
                          className="w-24 p-3 border-2 border-gray-300 rounded-lg text-lg text-center focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-gray-600 font-bold">時間 / giờ</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 備考 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  備考 / Ghi chú
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="メモがあれば入力"
                />
              </div>

              {/* ボタン */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 bg-gray-300 text-gray-700 py-4 rounded-lg text-lg font-bold hover:bg-gray-400 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || (!editIsHoliday && !editClientId)}
                  className="flex-1 bg-green-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-300 hover:bg-green-700 active:bg-green-800 transition-colors"
                >
                  {editSubmitting ? '保存中...' : '保存する / Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
