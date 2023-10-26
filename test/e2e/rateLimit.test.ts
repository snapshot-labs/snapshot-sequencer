import fetch from 'node-fetch';
import { createClient } from 'redis';
import { sha256 } from '../../src/helpers/utils';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

describe('POST /', () => {
  describe('when the same request is already being processed', () => {
    let client;
    const payload = { test: 'test' };
    const key = `${process.env.RATE_LIMIT_KEYS_PREFIX}processing-requests`;

    beforeAll(async () => {
      client = createClient({ url: process.env.RATE_LIMIT_DATABASE_URL });
      await client.connect();
      await client.SADD(key, sha256(JSON.stringify(payload)));
    });

    afterAll(async () => {
      await client.DEL(key);
      await client.disconnect();
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
});
