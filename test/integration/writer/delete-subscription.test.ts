import db, { envelopDB, sequencerDB } from '../../../src/helpers/mysql';
import { action, verify } from '../../../src/writer/delete-subscription';

describe('writer/delete-subscription', () => {
  const TEST_PREFIX = 'test-delete-subscription';

  afterAll(async () => {
    await envelopDB.queryAsync('DELETE FROM subscribers');
    await envelopDB.endAsync();
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('verify()', () => {
    beforeAll(async () => {
      await Promise.all([
        envelopDB.queryAsync(
          'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
          [`${TEST_PREFIX}-0x0`, 'test@snapshot.org', '[]', 0, 0]
        ),
        envelopDB.queryAsync(
          'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
          [`${TEST_PREFIX}-0x1`, 'test1@snapshot.org', '[]', 0, 1]
        )
      ]);
    });

    it('rejects when the address is not subscribed', () => {
      return expect(verify({ address: '0x0' })).rejects.toEqual(`user not subscribed`);
    });

    it('rejects when the address is not verified', () => {
      return expect(verify({ address: `${TEST_PREFIX}-0x0` })).rejects.toEqual(
        `user not subscribed`
      );
    });

    it('resolves when the address is verified', () => {
      return expect(verify({ address: `${TEST_PREFIX}-0x1` })).resolves.toHaveProperty('address');
    });
  });

  describe('action()', () => {
    const address = `${TEST_PREFIX}-0x3`;

    beforeAll(async () => {
      await Promise.all([
        envelopDB.queryAsync(
          'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
          [address, 'test@snapshot.org', '[]', 0, 0]
        ),
        envelopDB.queryAsync(
          'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
          [address, 'test1@snapshot.org', '[]', 0, 1]
        )
      ]);
    });

    it('deletes the subscription', async () => {
      await action({ address: address });

      const results = await envelopDB.queryAsync('SELECT * FROM subscribers WHERE address = ?', [
        address
      ]);

      // Only delete the verified subscription
      expect(results.length).toBe(1);
      expect(results[0].email).toEqual('test@snapshot.org');
    });
  });
});
