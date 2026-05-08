# AGENTS.md — cham-app

このリポジトリで自動エージェントが作業するときに守るルール。詳細は `CLAUDE.md` を参照。

## ローカルパス（厳守）

- **このリポジトリのローカル位置: `~/dev/cham-app`**
- ⚠️ `~/Desktop` 配下や iCloud Drive 同期対象フォルダに置かない。Desktop は macOS のデフォルトで iCloud Drive 同期される設定が多く、Next.js 14 の `next dev` がファイル監視で詰まり「Starting...」から進まない症状が発生する（2026-05-08 に発生・修正済み）

## 開発サーバー運用ルール（厳守）

このマシンには複数の Next.js プロジェクトが同時稼働している。**他プロジェクトを巻き込まないため**、以下のルールを必ず守ること。

- **ポートは 3100 を使う**（3000 は他プロジェクト [diet-map] が使用中で、絶対に奪わない）
- `package.json` の `dev`/`start` スクリプトは `-p 3100` 指定済み。書き換えない
- 起動: `npm run dev` または `next dev -p 3100`（`PORT=` 環境変数による上書き禁止）
- 停止: **`lsof -ti:3100 | xargs kill -9 2>/dev/null` だけを使う**
- **`pkill -f "next dev"` / `pkill -f next` は絶対に使わない**（他プロジェクトの dev サーバまで殺してしまう）
- ポートが使われているか調べる時は `lsof -i :3100`（PIDだけ欲しいなら `lsof -ti:3100`）

## DB（Supabase）運用ルール

- Project ID: `yophqxsevhsylcxewjcp`（Pro Plan、自動日次バックアップ7日分あり）
- **既存テーブル `employees` / `clients` / `attendance` / `admin_users` / `payroll_adjustments` のカラム削除・rename・型変更は禁止**
- スキーマ変更は「追加のみ」。既存カラムは触らない
- 物理削除は避け、論理削除（`deleted_at` カラム）を使う方針
- 運用中の本番データなので、破壊的変更前に手動 `pg_dump` を取る
