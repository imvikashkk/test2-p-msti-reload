-- Run this once to set up the DB schema

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  mobile      VARCHAR(15) NOT NULL UNIQUE,
  country_code VARCHAR(5) NOT NULL DEFAULT '91',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otps (
  id         SERIAL PRIMARY KEY,
  mobile     VARCHAR(15) NOT NULL,
  otp        VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_mobile ON otps(mobile);

CREATE TABLE IF NOT EXISTS plans (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  original_price INTEGER NOT NULL,
  price          INTEGER NOT NULL,
  duration_days  INTEGER NOT NULL,
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, price, duration_days, description) VALUES
  ('Trial Pack',  169,   3,   'Pehle try karo, phir socho'),
  ('Short Plan',  199,   15,  'Sabse popular choice'),
  ('Monthly',     349,   30,  'Poore mahine ka mazza'),
  ('Yearly',      599,   365, 'Saal bhar — sab se sasta')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  plan_id     INTEGER NOT NULL REFERENCES plans(id),
  start_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date    TIMESTAMPTZ NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | expired | cancelled
  payment_id  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  plan_id           INTEGER NOT NULL REFERENCES plans(id),
  txn_id            VARCHAR(100) NOT NULL UNIQUE,
  amount            INTEGER NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed
  easebuzz_txn_id   VARCHAR(200),
  easebuzz_response JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pay_txn ON payments(txn_id);
CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id);
