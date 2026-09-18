export type UserRole = "ADMIN" | "HOST" | "BUYER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isAuthorizedHost: boolean;
  country: string;
  currency: string;
  availableBalance: number;
  lockedBalance: number;
}

export type AuctionStatus = "DRAFT" | "UPCOMING" | "LIVE" | "PAUSED" | "ENDED" | "CANCELLED";

export interface Auction {
  id: string;
  host_id: string;
  host_name?: string;
  title: string;
  description: string;
  category_id: string;
  category_name?: string;
  image_url: string;
  starting_price: number | string;
  min_increment: number | string;
  current_highest_bid: number | string;
  highest_bidder_id?: string | null;
  highest_bidder_name?: string | null;
  total_bids_count: number;
  unique_bidders_count: number;
  start_time: string;
  end_time: string;
  status: AuctionStatus;
  subscription_fee: number;
  is_subscription_paid: boolean;
  winner_id?: string | null;
  winner_name?: string | null;
  winning_bid_amount?: number | string | null;
  settled_at?: string | null;
  sequence_version: number;
  minNextBid?: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number | string;
  idempotency_key: string;
  server_timestamp: string;
  server_timestamp_ms: number | string;
  sequence_number: number;
  status: string;
}

export interface WalletLedgerItem {
  id: string;
  user_id: string;
  type: "TOP_UP" | "BID_RESERVE" | "BID_RELEASE" | "WINNER_RELEASE" | "HOST_CREDIT" | "SUBSCRIPTION_PAYMENT" | "REFUND";
  amount: number | string;
  available_delta: number | string;
  locked_delta: number | string;
  balance_after: number | string;
  reference_id: string;
  description: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export type Notification = NotificationItem;

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

export interface ReportItem {
  id: string;
  reporter_name?: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
}

export interface StressTestRun {
  id: string;
  auctionId: string;
  scenario: string;
  status: "RUNNING" | "COMPLETED" | "STOPPED" | "FAILED";
  totalRequests: number;
  completedRequests: number;
  successfulBids: number;
  rejectedBids: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  currentRps: number;
  invariantsPassed: boolean;
  invariantsAudit?: any;
  startedAt: string;
  finishedAt?: string;
  logs?: string[];
}
