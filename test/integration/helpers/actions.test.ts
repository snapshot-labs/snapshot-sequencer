import { getSpace } from '../../../src/helpers/actions';
import db from '../../../src/helpers/mysql';
import fixtures from '../../fixtures/space';

describe('helpers/actions', () => {
  afterAll(async () => {
    await db.endAsync();
  });

  describe('getSpace()', () => {
    beforeEach(async () => {
      const spaces = fixtures.map(space => ({
        ...space,
        settings: JSON.stringify(space.settings)
      }));
      await db.queryAsync('INSERT INTO snapshot_sequencer_test.spaces SET ?', spaces);
    });

    afterEach(async () => {
      await db.queryAsync('DELETE FROM snapshot_sequencer_test.spaces');
    });

    it('returns the space for the given ID', () => {
      expect(getSpace('test.eth')).resolves.toEqual({
        verified: true,
        flagged: false,
        deleted: false,
        name: 'Test Space',
        admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
        symbol: 'TEST',
        network: '1',
        strategies: [
          {
            name: 'ticket',
            params: {}
          }
        ]
      });
    });

    it('does not return deleted space by default', async () => {
      await db.queryAsync(
        'UPDATE snapshot_sequencer_test.spaces SET deleted = 1 WHERE id = ? LIMIT 1',
        ['test.eth']
      );
      expect(getSpace('test.eth')).resolves.toBe(false);
    });

    it('returns deleted space when asked', async () => {
      await db.queryAsync(
        'UPDATE snapshot_sequencer_test.spaces SET deleted = 1 WHERE id = ? LIMIT 1',
        ['test.eth']
      );
      expect(getSpace('test.eth', true)).resolves.toEqual({
        verified: true,
        flagged: false,
        deleted: true,
        name: 'Test Space',
        admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
        symbol: 'TEST',
        network: '1',
        strategies: [
          {
            name: 'ticket',
            params: {}
          }
        ]
      });
    });

    it('returns false when no space is found', () => {
      expect(getSpace('test-space.eth')).resolves.toBe(false);
    });
  });
});
