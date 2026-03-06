'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  has_night_shift: boolean;
  has_trip: boolean;
};

export default function AttendancePage() {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [date, setDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [shiftType, setShiftType] = useState('day');
  const [hasOvertime, setHasOvertime] = useState(false);
  const [overtimeHours, setOvertimeHours] = useState('');
  const [isHoliday, setIsHoliday] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem('employee_id');
    const name = sessionStorage.getItem('employee_name');
    if (!id || !name) {
      window.location.href = '/';
      return;
    }
    setEmployeeId(id);
    setEmployeeName(name);

    // 今日の日付をセット
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);

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

  function handleClientChange(id: string) {
    setClientId(id);
    const client = clients.find(c => c.id === id) || null;
    setSelectedClient(client);
    // 取引先が変わったら勤務タイプをリセット
    setShiftType('day');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId && !date) return;

    setSubmitting(true);

    const { error } = await supabase.from('attendance').insert({
      employee_id: employeeId,
      date,
      client_id: clientId,
      site_name: siteName,
      shift_type: isHoliday ? 'day' : shiftType,
      has_overtime: hasOvertime,
      overtime_hours: hasOvertime ? parseFloat(overtimeHours) || 0 : 0,
      is_holiday: isHoliday,
      note,
    });

    setSubmitting(false);

    if (error) {
      alert('エラーが発生しました / Đã xảy ra lỗi: ' + error.message);
    } else {
      setShowSuccess(true);
      // フォームリセット
      setSiteName('');
      setShiftType('day');
      setHasOvertime(false);
      setOvertimeHours('');
      setIsHoliday(false);
      setNote('');
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-blue-800 text-white p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <a href="/" className="text-blue-200 hover:text-white">&larr; 戻る</a>
          <h1 className="text-lg font-bold">出勤入力</h1>
          <span className="text-blue-200 text-sm">{employeeName}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {showSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
            <div className="bg-white rounded-3xl p-10 mx-4 text-center shadow-2xl max-w-xs w-full">
              <div className="text-7xl mb-5">✅</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">登録しました！</h2>
              <p className="text-xl font-semibold text-gray-700 mb-3">お疲れ様でした！</p>
              <p className="text-sm text-gray-400">Đã đăng ký! Cảm ơn bạn!</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-5 space-y-4">
          {/* 日付 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              日付 / Ngày <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* 休み切替 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHoliday}
                onChange={(e) => setIsHoliday(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-bold text-gray-700">
                休み（作業なし）/ Nghỉ
              </span>
            </label>
          </div>

          {!isHoliday && (
            <>
              {/* 取引先 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  取引先 / Đối tác <span className="text-red-500">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
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
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
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
                    onClick={() => setShiftType('day')}
                    className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                      shiftType === 'day'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    日勤<br/><span className="text-xs">Ca ngày</span>
                  </button>
                  {selectedClient?.has_night_shift && (
                    <button
                      type="button"
                      onClick={() => setShiftType('night')}
                      className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                        shiftType === 'night'
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
                        onClick={() => setShiftType('trip_day')}
                        className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                          shiftType === 'trip_day'
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-300 text-gray-600'
                        }`}
                      >
                        出張日勤<br/><span className="text-xs">Đi công tác ngày</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShiftType('trip_night')}
                        className={`p-3 rounded-lg border-2 font-bold text-center transition-colors ${
                          shiftType === 'trip_night'
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
                    checked={hasOvertime}
                    onChange={(e) => setHasOvertime(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-bold text-gray-700">
                    残業あり / Làm thêm giờ
                  </span>
                </label>
                {hasOvertime && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={overtimeHours}
                      onChange={(e) => setOvertimeHours(e.target.value)}
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="メモがあれば入力"
            />
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={submitting || (!isHoliday && !clientId)}
            className="w-full bg-green-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-300 hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            {submitting ? '送信中...' : '登録する / Đăng ký'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/history" className="text-blue-600 underline text-sm">
            入力履歴を見る / Xem lịch sử
          </a>
        </div>
      </main>
    </div>
  );
}
