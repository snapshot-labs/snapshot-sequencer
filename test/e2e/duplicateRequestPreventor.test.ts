import fetch from 'node-fetch';
import Redis from 'ioredis';
import { sha256 } from '../../src/helpers/utils';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

describe('POST /', () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) {
    it.todo('needs to set RATE_LIMIT_DATABASE_URL to test this feature');
  } else {
    describe('when the same request is already being processed', () => {
      const client = new Redis(process.env.RATE_LIMIT_DATABASE_URL as string);
      const payload = { test: 'test' };
      const key = `${process.env.RATE_LIMIT_KEYS_PREFIX}processing-requests`;

      beforeAll(async () => {
        await client.sadd(key, sha256(JSON.stringify(payload)));
      });

      afterAll(async () => {
        await client.del(key);
      });

      it('returns a 429 error', async () => {
        const response = await fetch(HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toBe('client_error');
        expect(body.error_description).toBe('request already being processed');
      });
    });

    describe('when the request is not already being processed', () => {
      it('process and return response from the ingestor', async () => {
        const response = await fetch(HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalInput)
        });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('client_error');
        expect(body.error_description).toBe('wrong timestamp');
      });
    });
  }
});
