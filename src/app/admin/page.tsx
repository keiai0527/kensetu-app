'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalClients: 0,
    thisMonthAttendance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
      window.location.href = '/admin/login';
      return;
    }
    fetchStats();
  }, []);

  async function fetchStats() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const [empRes, clientRes, attRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('attendance').select('id', { count: 'exact' }).gte('date', startDate).lt('date', endDate).eq('is_holiday', false),
    ]);

    setStats({
      totalEmployees: empRes.count || 0,
      totalClients: clientRes.count || 0,
      thisMonthAttendance: attRes.count || 0,
    });
    setLoading(false);
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_logged_in');
    sessionStorage.removeItem('admin_username');
    window.location.href = '/admin/login';
  }

  const menuItems = [
    { href: '/admin/employees', label: '従業員マスター', icon: '👷', desc: '従業員の追加・編集' },
    { href: '/admin/clients', label: '取引先マスター', icon: '🏢', desc: '取引先・単価の管理' },
    { href: '/admin/attendance', label: '出勤記録', icon: '📋', desc: '全従業員の出勤確認・修正' },
    { href: '/admin/monthly', label: '月次集計', icon: '📊', desc: '人工集計・売上集計' },
    { href: '/admin/payroll', label: '給与計算', icon: '💰', desc: '給与自動計算・手修正' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">管理画面</h1>
          <button onClick={handleLogout} className="text-gray-300 hover:text-white text-sm">
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</div>
            <div className="text-sm text-gray-500 mt-1">在籍従業員</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.totalClients}</div>
            <div className="text-sm text-gray-500 mt-1">取引先</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.thisMonthAttendance}</div>
            <div className="text-sm text-gray-500 mt-1">今月の出勤</div>
          </div>
        </div>

        {/* メニュー */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition-shadow flex items-center gap-4"
            >
              <span className="text-3xl">{item.icon}</span>
              <div>
                <div className="font-bold text-gray-800">{item.label}</div>
                <div className="text-sm text-gray-500">{item.desc}</div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-gray-500 text-sm hover:text-gray-700">← 従業員画面に戻る</a>
        </div>
      </main>
    </div>
  );
}
