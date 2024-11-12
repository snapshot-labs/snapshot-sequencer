import db, { envelopDB, sequencerDB } from '../../../src/helpers/mysql';
import { action, verify } from '../../../src/writer/update-subscription';

describe('writer/update-subscription', () => {
  const TEST_PREFIX = 'test-update-subscription';

  afterAll(async () => {
    await envelopDB.queryAsync('DELETE FROM subscribers');
    await envelopDB.endAsync();
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('verify()', () => {
    const msg = JSON.stringify({ payload: { subscriptions: ['closedProposal'] } });
    const msgWithInvalidSubscriptions = JSON.stringify({
      payload: { subscriptions: ['test'] }
    });

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
      return expect(verify({ address: '0x0', msg })).rejects.toEqual(`user not subscribed`);
    });

    it('rejects when the address is not verified', () => {
      return expect(verify({ address: `${TEST_PREFIX}-0x0`, msg })).rejects.toEqual(
        `email not verified`
      );
    });

    it('rejects when subscription values are not valid', () => {
      return expect(
        verify({ address: `${TEST_PREFIX}-0x1`, msg: msgWithInvalidSubscriptions })
      ).rejects.toEqual(`invalid subscription value`);
    });

    it('resolves when all args are valid', () => {
      return expect(verify({ address: `${TEST_PREFIX}-0x1`, msg })).resolves.toHaveProperty(
        'address'
      );
    });
  });

  describe('action()', () => {
    const address = `${TEST_PREFIX}-0x3`;
    const subscriptions = ['newProposal', 'closedProposal'];

    beforeAll(async () => {
      await envelopDB.queryAsync(
        'INSERT INTO subscribers SET address = ?, email = ?, subscriptions = ?, created = ?, verified = ?',
        [address, 'test@snapshot.org', '["summary"]', 0, 1]
      );
    });

    it('updates the subscription', async () => {
      await action({
        address: address,
        msg: JSON.stringify({ payload: { subscriptions } })
      });

      const result = await envelopDB.queryAsync(
        `SELECT subscriptions FROM subscribers WHERE address = ? LIMIT 1`,
        [address]
      );

      expect(JSON.parse(result[0].subscriptions)).toEqual(subscriptions);
    });
  });
});
