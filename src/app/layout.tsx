import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cham",
  description: "出勤管理アプリ - 株式会社敬愛興業",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
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
      <body className="antialiased flex flex-col min-h-screen pb-8">
        <header className="bg-blue-700 text-white text-center py-4">
          <h1 className="text-2xl font-bold">Cham</h1>
          <p className="text-sm opacity-80">勤怠管理・給与計算システム</p>
        </header>
        <div className="flex-1">
          {children}
        </div>
        <footer className="fixed bottom-0 left-0 right-0 text-center text-xs text-gray-500 py-2 bg-white border-t border-gray-200 z-40">
          株式会社敬愛興業が作成管理するアプリケーションです
        </footer>
      </body>
    </html>
  );
}
