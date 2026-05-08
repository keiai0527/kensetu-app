'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmed = identifier.trim();
    const looksLikeEmail = trimmed.includes('@');

    if (looksLikeEmail) {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmed.toLowerCase(),
        password,
      });
      if (!authError && data.session) {
        sessionStorage.setItem('admin_logged_in', 'true');
        sessionStorage.setItem('admin_username', data.user?.email ?? identifier);
        window.location.href = '/admin';
        return;
      }
    }

    const { data: row, error: dbError } = await supabase
      .from('admin_users')
      .select('id, username, password_hash')
      .eq('username', identifier)
      .single();

    setLoading(false);

    if (dbError || !row || row.password_hash !== password) {
      setError('ユーザー名（またはメール）かパスワードが間違っています');
      return;
    }

    sessionStorage.setItem('admin_logged_in', 'true');
    sessionStorage.setItem('admin_username', row.username);
    window.location.href = '/admin';
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          管理者ログイン
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              メールアドレス または ユーザー名
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/admin/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            パスワードをお忘れですか？
          </a>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-gray-500 text-sm hover:text-gray-700">← トップに戻る</a>
        </div>
      </div>
    </div>
  );
}
