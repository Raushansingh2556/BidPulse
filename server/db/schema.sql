-- ==============================================================================
-- REAL-TIME TRANSACTIONAL AUCTION PLATFORM SCHEMA
-- Concurrency-Safe PostgreSQL DDL with Strict Constraints & Indexes
-- ==============================================================================

-- Create custom enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'HOST', 'BUYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE auction_status AS ENUM ('DRAFT', 'UPCOMING', 'LIVE', 'PAUSED', 'ENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ledger_tx_type AS ENUM (
        'TOP_UP',
        'BID_RESERVE',
        'BID_RELEASE',
        'WINNER_RELEASE',
        'HOST_CREDIT',
        'SUBSCRIPTION_PAYMENT',
        'REFUND'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE change_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'BUYER',
    is_authorized_host BOOLEAN NOT NULL DEFAULT FALSE,
    host_approved_at TIMESTAMPTZ,
    country VARCHAR(10) NOT NULL DEFAULT 'IN',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    profile_photo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AUCTIONS TABLE
CREATE TABLE IF NOT EXISTS auctions (
    id VARCHAR(64) PRIMARY KEY,
    host_id VARCHAR(64) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id VARCHAR(64) REFERENCES categories(id),
    image_url TEXT NOT NULL,
    starting_price NUMERIC(14, 2) NOT NULL CHECK (starting_price >= 0),
    min_increment NUMERIC(14, 2) NOT NULL CHECK (min_increment > 0),
    current_highest_bid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (current_highest_bid >= 0),
    highest_bidder_id VARCHAR(64) REFERENCES users(id),
    total_bids_count INTEGER NOT NULL DEFAULT 0 CHECK (total_bids_count >= 0),
    unique_bidders_count INTEGER NOT NULL DEFAULT 0 CHECK (unique_bidders_count >= 0),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    subscription_fee NUMERIC(10, 2) NOT NULL DEFAULT 99 CHECK (subscription_fee >= 0),
    is_subscription_paid BOOLEAN NOT NULL DEFAULT FALSE,
    winner_id VARCHAR(64) REFERENCES users(id),
    winning_bid_amount NUMERIC(14, 2),
    settled_at TIMESTAMPTZ,
    sequence_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_end_after_start CHECK (end_time > start_time)
);

-- 4. BIDS TABLE (Source of truth for all accepted bids)
CREATE TABLE IF NOT EXISTS bids (
    id VARCHAR(64) PRIMARY KEY,
    auction_id VARCHAR(64) NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id VARCHAR(64) NOT NULL REFERENCES users(id),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_timestamp_ms BIGINT NOT NULL,
    sequence_number BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AUCTION PARTICIPANTS (Track all unique bidders per auction)
CREATE TABLE IF NOT EXISTS auction_participants (
    auction_id VARCHAR(64) NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    first_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_bid_at TIMESTAMPTZ,
    is_favorited BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (auction_id, user_id)
);

-- 6. WALLETS TABLE
CREATE TABLE IF NOT EXISTS wallets (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
    total_balance NUMERIC(14, 2) GENERATED ALWAYS AS (available_balance + locked_balance) STORED,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. WALLET LEDGER (Immutable financial audit trail)
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    type VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    available_delta NUMERIC(14, 2) NOT NULL,
    locked_delta NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    reference_id VARCHAR(128) NOT NULL,
    description TEXT,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TRANSACTIONAL OUTBOX EVENTS
CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(64) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    sequence_number BIGINT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AUCTION CHANGE REQUESTS (Host submitting modification after publication)
CREATE TABLE IF NOT EXISTS auction_change_requests (
    id VARCHAR(64) PRIMARY KEY,
    auction_id VARCHAR(64) NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    host_id VARCHAR(64) NOT NULL REFERENCES users(id),
    proposed_changes JSONB NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    reviewed_by VARCHAR(64) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    reporter_id VARCHAR(64) NOT NULL REFERENCES users(id),
    target_type VARCHAR(32) NOT NULL, -- 'AUCTION', 'USER', 'BID'
    target_id VARCHAR(64) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    replies JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. STRESS TEST RUNS (Audit of real concurrent benchmark runs)
CREATE TABLE IF NOT EXISTS stress_test_runs (
    id VARCHAR(64) PRIMARY KEY,
    auction_id VARCHAR(64) NOT NULL REFERENCES auctions(id),
    concurrency INTEGER NOT NULL,
    target_rps INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_bids INTEGER NOT NULL DEFAULT 0,
    rejected_bids INTEGER NOT NULL DEFAULT 0,
    serialization_retries INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0,
    p95_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0,
    p99_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    invariants_passed BOOLEAN NOT NULL DEFAULT TRUE,
    invariants_audit JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 14. AUCTION CHANGE REQUESTS (Pre-start modifications requested by hosts)
CREATE TABLE IF NOT EXISTS auction_change_requests (
    id VARCHAR(64) PRIMARY KEY,
    auction_id VARCHAR(64) NOT NULL REFERENCES auctions(id),
    host_id VARCHAR(64) NOT NULL REFERENCES users(id),
    proposed_title VARCHAR(255),
    proposed_description TEXT,
    proposed_starting_price NUMERIC(14, 2),
    proposed_min_increment NUMERIC(14, 2),
    proposed_start_time TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    reviewed_by VARCHAR(64) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH-THROUGHPUT SERIALIZATION & REPORTING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_auctions_status_times ON auctions(status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_auctions_host ON auctions(host_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction_created ON bids(auction_id, server_timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_bids_auction_amount ON bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON wallet_ledger(reference_id);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(published, created_at) WHERE published = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
