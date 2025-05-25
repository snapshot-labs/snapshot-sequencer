import { isExistingAlias } from '../../../src/helpers/alias';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import { aliasesSqlFixtures } from '../../fixtures/alias';

describe('alias', () => {
  const seed = Date.now().toFixed(0);

  beforeAll(async () => {
    await db.queryAsync('DELETE from snapshot_sequencer_test.aliases');
    await Promise.all(
      aliasesSqlFixtures.map(alias => {
        const values = {
          ...alias,
          ipfs: seed
        };
        return db.queryAsync('INSERT INTO snapshot_sequencer_test.aliases SET ?', values);
      })
    );
  });

  afterEach(async () => {
    await db.queryAsync('DELETE from snapshot_sequencer_test.aliases where ipfs = ?', seed);
  });

  afterAll(async () => {
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('isExistingAlias()', () => {
    it('should return true for valid alias', () => {
      expect(
        isExistingAlias(aliasesSqlFixtures[0].address, aliasesSqlFixtures[0].alias)
      ).resolves.toBe(true);
    });

    it('should return false for un-existing alias', () => {
      expect(isExistingAlias(aliasesSqlFixtures[0].address, 'invalid-alias')).resolves.toBe(false);
    });

    it('should return false for expired alias', () => {
      expect(
        isExistingAlias(aliasesSqlFixtures[2].address, aliasesSqlFixtures[2].alias)
      ).resolves.toBe(false);
    });
  });
});
