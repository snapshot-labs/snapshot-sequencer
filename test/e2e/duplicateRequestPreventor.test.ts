import fetch from 'node-fetch';
import RedisClient from '../../src/helpers/redis';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';
import { ERROR_MESSAGE, DUPLICATOR_SET_KEY } from '../../src/helpers/duplicateRequestPreventor';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

async function send(payload) {
  return await fetch(HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

describe('POST /', () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) {
    it.todo('needs to set RATE_LIMIT_DATABASE_URL to test this feature');
  } else {
    describe('when the same request is already being processed', () => {
      const payload = { sig: 'test' };

      beforeAll(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await RedisClient.sAdd(DUPLICATOR_SET_KEY, JSON.stringify(payload.sig));
      });

      afterAll(async () => {
        await RedisClient.del(DUPLICATOR_SET_KEY);
        await RedisClient.quit();
      });

      it('returns a 429 error', async () => {
        const response = await send(payload);
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toBe('client_error');
        expect(body.error_description).toBe(ERROR_MESSAGE);
      });
    });

    describe('when the request is not already being processed', () => {
      it('process and return response from the ingestor', async () => {
        const response = await send(proposalInput);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('client_error');
        expect(body.error_description).toBe('wrong timestamp');
      });
    });
  }
});
