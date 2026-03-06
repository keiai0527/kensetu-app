import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cham",
  description: "出勤管理アプリ - 株式会社敬愛興業",
  appleWebApp: {
    title: "Cham",
    capable: true,
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased flex flex-col min-h-screen">
        <header className="bg-blue-700 text-white text-center py-4">
          <h1 className="text-2xl font-bold">Cham</h1>
          <p className="text-sm opacity-80">Ứng dụng quản lý chấm công</p>
        </header>
        <div className="flex-1">
          {children}
        </div>
        <footer className="text-center text-xs text-gray-400 py-2 bg-white border-t border-gray-100">
          株式会社敬愛興業が作成管理するアプリケーションです
        </footer>
      </body>
    </html>
  );
}
