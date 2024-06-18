import { getSpace, sxSpaceExists } from '../../../src/helpers/actions';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import { DEFAULT_NETWORK_ID } from '../../../src/helpers/utils';
import { spacesSqlFixtures } from '../../fixtures/space';

describe('helpers/actions', () => {
  afterAll(async () => {
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  const expectedSpace = {
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
  };

  const expectedDeletedSpace = {
    name: 'Test deleted space',
    verified: false,
    flagged: false,
    deleted: true,
    hibernated: false,
    turbo: false,
    admins: ['0x87D68ecFBcF53c857ABf494728Cf3DE1016b27B0'],
    symbol: 'TEST2',
    network: '1',
    strategies: [{ name: 'basic' }]
  };

  describe('getSpace()', () => {
    beforeAll(async () => {
      await Promise.all(
        spacesSqlFixtures.map(space => {
          const values = {
            ...space,
            settings: JSON.stringify(space.settings)
          };
          return db.queryAsync('INSERT INTO snapshot_sequencer_test.spaces SET ?', values);
        })
      );
    });

    afterAll(async () => {
      await db.queryAsync('DELETE FROM snapshot_sequencer_test.spaces');
    });

    describe('for snapshot space', () => {
      it('returns the space for the given ID', () => {
        return expect(getSpace('test.eth')).resolves.toEqual(expectedSpace);
      });

      it('returns the space (case-insensitive) for the given ID', () => {
        return expect(getSpace('TEST.eth')).resolves.toEqual(expectedSpace);
      });

      it('returns the space for the given ID with a valid network', () => {
        return expect(getSpace('test.eth', false, DEFAULT_NETWORK_ID)).resolves.toEqual(
          expectedSpace
        );
      });

      it('returns a snapshot space for the given ID with an invalid network', () => {
        return expect(getSpace('test.eth', false, 'hello-world')).resolves.toEqual(expectedSpace);
      });

      it('does not return deleted space by default', () => {
        return expect(getSpace('test-deleted.eth')).resolves.toBe(false);
      });

      it('returns deleted space when asked', () => {
        return expect(getSpace('test-deleted.eth', true)).resolves.toEqual(expectedDeletedSpace);
      });

      it('returns false when no space is found', () => {
        return expect(getSpace('test-space.eth')).resolves.toBe(false);
      });
    });

    describe('for sx spaces', () => {
      it('returns the space for the given ID', () => {
        return expect(
          getSpace('0xaeee929Ca508Dd1F185a8E74F4a9c37c25595c25', false, 'eth')
        ).resolves.toEqual({
          network: 0
        });
      });

      it('returns false when the space does not exist', () => {
        return expect(getSpace('not-existing-space-id', false, 'eth')).resolves.toBe(false);
      });
    });
  });

  describe('sxSpaceExists()', () => {
    const mapping = {
      sn: '0x001080f1ced38269d7a32068700179c6335dee568f8599cf74b120869f8ec641',
      arb1: '0xFd36252770642Ac48FC3A06d7A1D00be8946dd18',
      oeth: '0x82572911308D2579f15e3cF21402Dcf1D5408300',
      matic: '0x80D0Ffd8739eABF16436074fF64DC081c60C833A',
      eth: '0xaeee929Ca508Dd1F185a8E74F4a9c37c25595c25'
    };

    it.each(Object.entries(mapping))('returns true when it exists for %s', async (network, id) => {
      return expect(sxSpaceExists(network, id)).resolves.toEqual(true);
    });

    it('returns false when it does not exist', async () => {
      return expect(sxSpaceExists('sep', mapping['eth'])).resolves.toEqual(false);
    });
  });
});
