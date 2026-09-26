-- ════════════════════════════════════════════════════════════════
--  ThunderGym — Membership & Access Control Schema (MySQL 8 / MariaDB)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  username      VARCHAR(60)   NOT NULL UNIQUE,
  phone         VARCHAR(30)   NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('owner','staff') NOT NULL DEFAULT 'staff',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name_ar       VARCHAR(120)  NOT NULL,
  name_en       VARCHAR(120)  NOT NULL,
  duration_days INT           NOT NULL,
  sessions      INT           NOT NULL DEFAULT 0,   -- 0 only for pre-upgrade legacy data; new plans require >0
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  color         VARCHAR(20)   NOT NULL DEFAULT '#FFC531',
  active        TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order    INT           NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  serial     VARCHAR(32)  NOT NULL UNIQUE,      -- human code e.g. TG-000123
  qr_token   CHAR(36)     NOT NULL UNIQUE,      -- opaque token inside the QR
  full_name  VARCHAR(160) NOT NULL,
  phone      VARCHAR(30)  NOT NULL,             -- international, digits only
  gender     ENUM('male','female') NOT NULL DEFAULT 'male',
  birth_date DATE         NULL,
  notes      TEXT         NULL,
  status     ENUM('active','frozen','blocked') NOT NULL DEFAULT 'active',
  frozen_at DATE NULL,
  freeze_until DATE NULL, -- resume date, NULL = manual unfreeze
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_members_phone (phone),
  INDEX idx_members_name  (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       INT           NOT NULL,
  plan_id         INT           NULL,
  plan_label      VARCHAR(120)  NOT NULL,
  duration_days   INT           NOT NULL,       -- 1 day … 365 days … anything
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid            DECIMAL(10,2) NOT NULL DEFAULT 0,
  status          ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  sessions_total  INT           NOT NULL DEFAULT 0, -- 0 only for pre-upgrade legacy data
  sessions_used   INT           NOT NULL DEFAULT 0,
  low_attendance_notified_at DATETIME NULL, -- once per subscription at/after half-time
  mid_notified_at DATETIME      NULL,           -- "half-way" reminder sent
  end_notified_at DATETIME      NULL,           -- "about to expire" reminder sent
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_sub_member (member_id),
  INDEX idx_sub_end    (end_date),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checkins (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       INT      NOT NULL,
  subscription_id INT      NULL,
  scanned_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_by      INT      NULL,
  result          ENUM('granted','denied_expired','denied_none','denied_blocked','denied_frozen','denied_duplicate') NOT NULL,
  days_left       INT      NULL,
  sessions_left   INT      NULL,
  consumed        TINYINT(1) NOT NULL DEFAULT 0,    -- 1 = a session was deducted
  source          VARCHAR(30) NOT NULL DEFAULT 'mobile_qr',
  CONSTRAINT fk_chk_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_chk_at     (scanned_at),
  INDEX idx_chk_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       VARCHAR(40)  NOT NULL,             -- checkin | denied | mid | end | expired | member_added
  member_id  INT          NULL,
  title_ar   VARCHAR(200) NOT NULL,
  title_en   VARCHAR(200) NOT NULL,
  body_ar    VARCHAR(400) NOT NULL,
  body_en    VARCHAR(400) NOT NULL,
  severity   ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_at   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  member_id       INT      NOT NULL,
  subscription_id INT      NULL,
  kind            ENUM('welcome','mid','end','expired','manual') NOT NULL,
  phone           VARCHAR(30) NOT NULL,
  body            TEXT     NOT NULL,
  status          ENUM('queued','opened','sent') NOT NULL DEFAULT 'queued',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NULL,
  CONSTRAINT fk_wa_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_wa_member (member_id),
  INDEX idx_wa_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  skey   VARCHAR(60) PRIMARY KEY,
  svalue TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Business ledger. Cash received is recorded per payment, not inferred from
-- subscription price; legacy_key ensures safe one-time import of older data.
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  member_id INT NOT NULL,
  kind ENUM('new','renewal','arrears') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(300) NOT NULL DEFAULT '',
  legacy_key VARCHAR(80) NULL UNIQUE,
  INDEX idx_pay_date (paid_at),
  INDEX idx_pay_member (member_id),
  INDEX idx_pay_sub (subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial VARCHAR(32) NULL UNIQUE,
  qr_token CHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  job_title VARCHAR(120) NOT NULL DEFAULT '',
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  clock_in DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out DATETIME NULL,
  INDEX idx_staff_day (staff_id, clock_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('salary','supplies','equipment','utilities','rent','other') NOT NULL,
  description VARCHAR(250) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  staff_id INT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expense_date (paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  avg_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  note VARCHAR(250) NOT NULL DEFAULT '',
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_date (purchased_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  cost_amount DECIMAL(12,2) NOT NULL,
  sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sales_date (sold_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
