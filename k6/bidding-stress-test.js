import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
export const successfulBids = new Counter('successful_bids');
export const rejectedBids = new Counter('rejected_bids');
export const bidLatency = new Trend('bid_latency');
export const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    hot_auction_concurrency: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 200 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<300'], // 95% of requests should be under 300ms
    'error_rate': ['rate<0.05'],       // less than 5% unexpected 500 errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const AUCTION_ID = __ENV.AUCTION_ID || 'auc_live_chandrayaan';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const uniqueKey = `k6_${Date.now()}_vu${vuId}_it${iterId}_${Math.random().toString(36).substring(2, 7)}`;

  // Formulate bid request with unique idempotency key
  const payload = JSON.stringify({
    amount: 15000 + (iterId * 500),
    idempotencyKey: uniqueKey,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': uniqueKey,
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/auctions/${AUCTION_ID}/bids`, payload, params);
  const latency = Date.now() - startTime;
  bidLatency.add(latency);

  const isSuccess = check(res, {
    'status is 200 or 400 (expected business outcome)': (r) => r.status === 200 || r.status === 400,
    'not 500 fatal': (r) => r.status !== 500,
  });

  if (!isSuccess) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  if (res.status === 200) {
    successfulBids.add(1);
  } else {
    rejectedBids.add(1);
  }

  sleep(0.05);
}
