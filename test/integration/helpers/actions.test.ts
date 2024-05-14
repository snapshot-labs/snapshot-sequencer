import { getSpace, sxSpaceExists } from '../../../src/helpers/actions';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import { spacesSqlFixtures } from '../../fixtures/space';

describe('helpers/actions', () => {
  afterAll(async () => {
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('getSpace()', () => {
    beforeEach(async () => {
      const spaces = spacesSqlFixtures.map(space => ({
        ...space,
        settings: JSON.stringify(space.settings)
      }));
      await db.queryAsync('INSERT INTO snapshot_sequencer_test.spaces SET ?', spaces);
    });

    afterEach(async () => {
      await db.queryAsync('DELETE FROM snapshot_sequencer_test.spaces');
    });

    describe('for snapshot space', () => {
      it('returns the space for the given ID', () => {
        expect(getSpace('test.eth')).resolves.toEqual({
          verified: true,
          flagged: false,
          deleted: false,
          hibernated: false,
          turbo: false,
          name: 'Test Space',
          admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
          symbol: 'TEST',
          network: '1',
          strategies: [{ name: 'basic' }]
        });
      });

      it('returns the space for the given ID with network', () => {
        expect(getSpace('test.eth', false, 's')).resolves.toEqual({
          verified: true,
          flagged: false,
          deleted: false,
          hibernated: false,
          turbo: false,
          name: 'Test Space',
          admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
          symbol: 'TEST',
          network: '1',
          strategies: [{ name: 'basic' }]
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
          hibernated: false,
          turbo: false,
          name: 'Test Space',
          admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
          symbol: 'TEST',
          network: '1',
          strategies: [{ name: 'basic' }]
        });
      });

      it('returns false when no space is found', () => {
        expect(getSpace('test-space.eth')).resolves.toBe(false);
      });
    });

    describe('for sx spaces', () => {
      it('returns the space for the given ID', () => {
        expect(
          getSpace('0xaeee929Ca508Dd1F185a8E74F4a9c37c25595c25', false, 'eth')
        ).resolves.toEqual({
          network: 1
        });
      });

      it('returns false when the space does not exist', () => {
        expect(getSpace('not-existing-space-id', false, 'eth')).resolves.toBe(false);
      });
    });
  });

  describe('sxSpaceExists()', () => {
    it('returns the space id when it exists', async () => {
      const id = '0xaeee929Ca508Dd1F185a8E74F4a9c37c25595c25';
      return expect(sxSpaceExists(id)).resolves.toEqual(true);
    });

    it('returns null when it does not exist', async () => {
      const id = 'not-existing-space-id';
      return expect(sxSpaceExists(id)).resolves.toEqual(false);
    });
  });
});
