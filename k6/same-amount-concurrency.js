import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    same_amount_race: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 100,
      maxDuration: '10s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const AUCTION_ID = __ENV.AUCTION_ID || 'auc_live_chandrayaan';

export default function () {
  // Every VU submits the exact same amount with unique keys to test PostgreSQL serialization
  const payload = JSON.stringify({
    amount: 25000,
    idempotencyKey: `race_vu${__VU}_it${__ITER}_${Math.random()}`,
  });

  const res = http.post(`${BASE_URL}/auctions/${AUCTION_ID}/bids`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `race_vu${__VU}_it${__ITER}_${Math.random()}`,
    },
  });

  check(res, {
    'handled gracefully': (r) => r.status === 200 || r.status === 400,
  });
}
