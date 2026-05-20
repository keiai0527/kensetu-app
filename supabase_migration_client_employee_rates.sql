-- 取引先×従業員 個別単価テーブル
-- Supabase の SQL Editor に貼り付けて 1 回だけ実行してください

CREATE TABLE IF NOT EXISTS client_employee_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_rate integer,
  overtime_rate integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_client_employee_rates_client ON client_employee_rates(client_id);
CREATE INDEX IF NOT EXISTS idx_client_employee_rates_employee ON client_employee_rates(employee_id);

-- 既存テーブル (clients / employees) と同じく anon キーで読み書き可能にする
ALTER TABLE client_employee_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON client_employee_rates;
CREATE POLICY "anon_all" ON client_employee_rates
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON client_employee_rates;
CREATE POLICY "authenticated_all" ON client_employee_rates
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
