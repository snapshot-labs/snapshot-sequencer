import { isExistingAlias } from '../../../src/helpers/alias';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import { verify } from '../../../src/writer/alias';
import { aliasesSqlFixtures } from '../../fixtures/alias';

describe('alias', () => {
  const seed = Date.now().toFixed(0);

  beforeEach(async () => {
    await db.queryAsync('DELETE from snapshot_sequencer_test.aliases WHERE ipfs = ?', seed);
    await Promise.all(
      aliasesSqlFixtures.map(alias => {
        const values = { ...alias, ipfs: seed };
        return db.queryAsync(
          'INSERT INTO snapshot_sequencer_test.aliases SET ? ON DUPLICATE KEY UPDATE ipfs = VALUES(ipfs), created = VALUES(created)',
          values
        );
      })
    );
  });

  afterAll(async () => {
    await db.queryAsync('DELETE from snapshot_sequencer_test.aliases WHERE ipfs = ?', seed);
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('verify()', () => {
    it('should reject when alias already exists', async () => {
      const { address, alias } = aliasesSqlFixtures[0];
      const msg = {
        version: '0.1.4',
        timestamp: Math.floor(Date.now() / 1000),
        type: 'alias',
        payload: { alias }
      };

      await expect(verify({ address, msg: JSON.stringify(msg) })).rejects.toMatch(
        'alias already exists'
      );
    });

    it('should pass when alias does not exist', async () => {
      const address = '0x0000000000000000000000000000000000000001';
      const msg = {
        version: '0.1.4',
        timestamp: Math.floor(Date.now() / 1000),
        type: 'alias',
        payload: { alias: '0x0000000000000000000000000000000000000002' }
      };

      await expect(verify({ address, msg: JSON.stringify(msg) })).resolves.toBeTruthy();
    });
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
