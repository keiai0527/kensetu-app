'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Employee = {
  id: string;
  name: string;
  name_vi: string | null;
};

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, name_vi')
      .eq('is_active', true)
      .order('display_order');

    if (data) setEmployees(data);
    setLoading(false);
  }

  function handleSelect() {
    const emp = employees.find(e => e.id === selectedId);
    if (emp) {
      setSelectedEmployee(emp);
      setShowConfirm(true);
    }
  }

  function handleConfirm() {
    if (selectedEmployee) {
      // sessionStorageに従業員情報を保存して出勤入力画面へ
      sessionStorage.setItem('employee_id', selectedEmployee.id);
      sessionStorage.setItem('employee_name', selectedEmployee.name);
      window.location.href = '/attendance';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* ヘッダー */}
      <header className="bg-blue-800 text-white p-4 text-center">
        <h1 className="text-xl font-bold">出勤管理アプリ</h1>
        <p className="text-blue-200 text-sm mt-1">Ứng dụng quản lý chấm công</p>
      </header>

      <main className="max-w-md mx-auto p-6 mt-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">名前を選んでください</h2>
          <p className="text-sm text-gray-500 mb-4">Hãy chọn tên của bạn</p>

          {employees.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              従業員が登録されていません。<br/>
              管理画面から従業員を追加してください。
            </p>
          ) : (
            <>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg mb-4 focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- 選択 / Chọn --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}{emp.name_vi ? ` (${emp.name_vi})` : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSelect}
                disabled={!selectedId}
                className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                決定 / Xác nhận
              </button>
            </>
          )}
        </div>

        {/* メニューリンク */}
        <div className="mt-6 text-center">
          <a href="/history" className="text-blue-600 underline text-sm">
            入力履歴を見る / Xem lịch sử
          </a>
        </div>

        {/* 管理者リンク */}
        <div className="mt-8 text-center">
          <a href="/admin/login" className="text-gray-400 text-xs">
            管理者ログイン
          </a>
        </div>
      </main>

      {/* 確認ダイアログ */}
      {showConfirm && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-4">確認 / Xác nhận</h3>
            <p className="text-center text-2xl font-bold text-blue-800 mb-2">
              {selectedEmployee.name}
            </p>
            {selectedEmployee.name_vi && (
              <p className="text-center text-lg text-gray-600 mb-4">
                {selectedEmployee.name_vi}
              </p>
            )}
            <p className="text-center text-gray-600 mb-6">
              さんですね？<br/>
              <span className="text-sm">Đúng là bạn phải không?</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border-2 border-gray-300 rounded-lg text-gray-600 font-bold hover:bg-gray-100"
              >
                いいえ / Không
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 active:bg-blue-800"
              >
                はい / Có
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
