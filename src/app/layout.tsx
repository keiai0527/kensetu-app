import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cham",
  description: "株式会社敬愛興業 出勤管理・人工集計・給与管理アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cham",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="text-center text-xs text-gray-400 py-2 bg-white border-t border-gray-100">
          株式会社敬愛興業が作成管理するアプリケーションです
        </footer>
      </body>
    </html>
  );
}
