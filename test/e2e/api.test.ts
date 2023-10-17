import fetch from 'node-fetch';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

describe('POST /', () => {
  describe('on invalid client input', () => {
    it('returns a 400 error', async () => {
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
