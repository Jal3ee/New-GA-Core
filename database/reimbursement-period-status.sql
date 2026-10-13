CREATE TABLE IF NOT EXISTS reimbursement_period_status (
  period_key VARCHAR(10) PRIMARY KEY CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-P[12]$'),
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'not_started'
    CHECK (workflow_status IN ('not_started','compiling','site_approval','head_finance_approval','payment_pending','paid')),
  tgl_pengajuan_finance DATE,
  tgl_pencairan_finance DATE,
  catatan TEXT NOT NULL DEFAULT '',
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
