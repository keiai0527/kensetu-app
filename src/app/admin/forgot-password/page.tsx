'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const redirectTo = `${window.location.origin}/admin/reset-password`;
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    setLoading(false);

    if (authError) {
      setError('送信に失敗しました。メールアドレスをご確認ください。');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
            メールを送信しました
          </h1>
          <p className="text-sm text-gray-600 mb-2 text-center">
            <strong>{email}</strong> 宛に
            <br />
            パスワード再設定用のリンクを送りました。
          </p>
          <p className="text-xs text-gray-500 mb-6 text-center">
            メールが届かない場合は迷惑メールフォルダもご確認ください。
            <br />
            数分待っても届かない場合はメールアドレスを再確認してください。
          </p>
          <div className="text-center">
            <a href="/admin/login" className="text-blue-600 underline text-sm">
              ログイン画面に戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          パスワード再設定
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          登録済みのメールアドレスを入力すると、
          <br />
          再設定用のリンクが送られます。
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? '送信中...' : '再設定メールを送る'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/admin/login" className="text-gray-500 text-sm hover:text-gray-700">
            ← ログイン画面に戻る
          </a>
        </div>
      </div>
    </div>
  );
}
