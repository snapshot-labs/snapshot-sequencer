import db, { envelopDB, sequencerDB } from '../../../src/helpers/mysql';
import { action, verify } from '../../../src/writer/email-subscription';

describe('writer/subscription', () => {
  const TEST_PREFIX = 'test-subscription';
  const msg = JSON.stringify({ payload: { email: 'test@snapshot.org', subscriptions: [] } });

  afterAll(async () => {
    await envelopDB.queryAsync('DELETE FROM subscribers');
    await envelopDB.endAsync();
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('verify()', () => {
    const address = `${TEST_PREFIX}-0x0`;
    const invalidMsg = JSON.stringify({
      payload: { email: 'not an email' }
    });

    beforeAll(async () => {
      await envelopDB.queryAsync(
        'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
        [address, 'test@snapshot.org', '[]', 0, 0]
      );
    });

    it('rejects when the address is already subscribed', () => {
      return expect(verify({ address: address, msg })).rejects.toEqual('email already subscribed');
    });

    it('rejects when the subscription type is not valid', () => {
      return expect(verify({ address: address, msg: invalidMsg })).rejects.toEqual(
        'wrong email subscription format'
      );
    });

    it('resolves when all args are valid', () => {
      return expect(verify({ address: `${TEST_PREFIX}-0x1`, msg })).resolves.toBe(true);
    });
  });

  describe('action()', () => {
    const address = `${TEST_PREFIX}-0x1`;

    it('creates a subscription', async () => {
      await action({
        address: address,
        msg
      });

      const result = await envelopDB.queryAsync(
        `SELECT * FROM subscribers WHERE address = ? LIMIT 1`,
        [address]
      );

      expect(result[0].email).toEqual('test@snapshot.org');
      expect(result[0].verified).toEqual(0);
    });
  });
});
