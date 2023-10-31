import fetch from 'node-fetch';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';
import redis from '../../src/helpers/redis';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

function successRequest() {
  return fetch(`${HOST}`);
}

function failRequest() {
  return fetch(HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proposalInput)
  });
}

describe('POST /', () => {
  beforeEach(async () => {
    const keyPrefix = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
    await redis.del(`${keyPrefix}rl:3e48ef9`);
    await redis.del(`${keyPrefix}rl-s:3e48ef9`);
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe('on invalid client input', () => {
    it('returns a 400 error', async () => {
      const response = await failRequest();
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('client_error');
      expect(body.error_description).toBe('wrong timestamp');
    });
  });

  describe('rate limit', () => {
    describe('on a mix of success and failed requests', () => {
      it('should return a 429 errors only after 100 requests / min', async () => {
        for (let i = 1; i <= 100; i++) {
          // 2% of failing requests
          const response = await (Math.random() < 0.02 ? failRequest() : successRequest());
          expect(response.status).not.toEqual(429);
        }

        const response = await fetch(HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalInput)
        });
        expect(response.status).toBe(429);
      });
    });

    describe('on multiple failed requests', () => {
      it('should return a 429 errors after 15 requests / 15s', async () => {
        for (let i = 1; i <= 15; i++) {
          const response = await failRequest();
          expect(response.status).toBe(400);
        }

        const response = await fetch(`${HOST}/scores/proposal-id`);
        expect(response.status).toBe(429);
      });
    });
  });
});
