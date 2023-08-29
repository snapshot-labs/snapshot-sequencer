import request from 'supertest';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';

const HOST = `http://localhost:${process.env.PORT || 3003}`;

describe('POST /', () => {
  describe('on invalid client input', () => {
    it('returns a 400 error', async () => {
      const result = await request(HOST).post('/').send(proposalInput);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('client_error');
      expect(result.body.error_description).toBe('wrong timestamp');
    });
  });
});
