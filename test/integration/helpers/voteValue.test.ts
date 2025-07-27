import dotenv from 'dotenv';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import { assignVotePrices } from '../../../src/helpers/voteValue';

dotenv.config();
dotenv.config({ path: 'test/.env.test', override: true });

describe('helpers/voteValue', () => {
  const voteId = 'test-vote-id-123';

  async function createDummyVote(id: string, vpByStrategy: number[]): Promise<void> {
    const voteRecord = {
      id,
      ipfs: 'test-ipfs-hash',
      voter: '0x1234567890123456789012345678901234567890',
      created: Math.floor(Date.now() / 1000),
      space: 'test-space.eth',
      proposal: 'test-proposal-id',
      choice: JSON.stringify(1),
      metadata: JSON.stringify({}),
      reason: '',
      app: 'test-app',
      vp: vpByStrategy.reduce((sum, vp) => sum + vp, 0),
      vp_by_strategy: JSON.stringify(vpByStrategy),
      vp_state: 'final',
      cb: 0
    };

    await db.queryAsync('INSERT INTO snapshot_sequencer_test.votes SET ?', voteRecord);
  }

  afterAll(async () => {
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  beforeEach(async () => {
    await db.queryAsync('DELETE FROM snapshot_sequencer_test.vote_prices');
    await db.queryAsync('DELETE FROM snapshot_sequencer_test.votes');
  });

  describe('assignVotePrices', () => {
    it('should handle unsupported strategies gracefully', async () => {
      await createDummyVote(voteId, [100]);

      const proposalWithUnsupportedStrategy = {
        strategies: [
          {
            name: 'unsupported-strategy',
            params: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              decimals: 6
            }
          }
        ],
        network: '1',
        snapshot: 12345678
      };

      await assignVotePrices(proposalWithUnsupportedStrategy, voteId, 1753644505);

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [voteId]
      );

      expect(result).toHaveLength(0);
    });

    it('should handle strategies without token address gracefully', async () => {
      await createDummyVote(voteId, [50]);

      const proposalWithoutAddress = {
        strategies: [
          {
            name: 'erc20-balance-of',
            params: {}
          }
        ],
        network: '1',
        snapshot: 12345678
      };

      await assignVotePrices(proposalWithoutAddress, voteId, 1753644505);

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [voteId]
      );

      expect(result).toHaveLength(0);
    });

    it('should handle non-numeric networks gracefully', async () => {
      await createDummyVote(voteId, [75]);

      const proposalWithStringNetwork = {
        strategies: [
          {
            name: 'erc20-balance-of',
            params: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              network: 'mainnet'
            }
          }
        ],
        network: 'ethereum',
        snapshot: 12345678
      };

      await assignVotePrices(proposalWithStringNetwork, voteId, 1753644505);

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [voteId]
      );

      expect(result).toHaveLength(0);
    });

    it('should process valid strategies and create price record', async () => {
      await createDummyVote(voteId, [1000]);

      const proposalWithValidStrategy = {
        strategies: [
          {
            name: 'erc20-balance-of',
            params: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              decimals: 6
            }
          }
        ],
        network: '1',
        snapshot: 12345678
      };

      await assignVotePrices(proposalWithValidStrategy, voteId, 1753644505);

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [voteId]
      );

      expect(result).toHaveLength(1);
      const usdValue = Number(result[0].usd_value);
      expect(usdValue).toBeCloseTo(999.8084874671561, 6);
    });

    it('should use strategy network params over main network when defined', async () => {
      const strategyNetworkVoteId = 'test-strategy-network-vote-id';
      await createDummyVote(strategyNetworkVoteId, [2]);

      const proposalWithStrategyNetwork = {
        strategies: [
          {
            name: 'erc20-balance-of',
            params: {
              address: '0x4200000000000000000000000000000000000006',
              decimals: 18,
              network: '8453'
            }
          }
        ],
        network: '1',
        snapshot: 12345678
      };

      await assignVotePrices(proposalWithStrategyNetwork, strategyNetworkVoteId, 1753644505);

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [strategyNetworkVoteId]
      );

      expect(result).toHaveLength(1);
      const usdValue = Number(result[0].usd_value);
      expect(usdValue).toBeCloseTo(7700.371260675566, 6);

      await db.queryAsync('DELETE FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?', [
        strategyNetworkVoteId
      ]);
    });

    it('should handle multiple strategies correctly', async () => {
      await createDummyVote(voteId, [500, 1.5, 200, 0]);

      const proposalWithMultipleStrategies = {
        strategies: [
          {
            name: 'erc20-balance-of',
            params: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              decimals: 6
            }
          },
          {
            name: 'erc20-balance-of',
            params: {
              address: '0x4200000000000000000000000000000000000006',
              decimals: 18,
              network: '8453'
            }
          },
          {
            name: 'unsupported-strategy',
            params: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              decimals: 6
            }
          },
          {
            name: 'erc20-balance-of',
            params: {}
          }
        ],
        network: '1',
        snapshot: 12345678
      };

      await expect(
        assignVotePrices(proposalWithMultipleStrategies, voteId, 1753644505)
      ).resolves.toBeUndefined();

      const result = await db.queryAsync(
        'SELECT usd_value FROM snapshot_sequencer_test.vote_prices WHERE vote_id = ?',
        [voteId]
      );

      expect(result).toHaveLength(1);
      const usdValue = Number(result[0].usd_value);
      expect(usdValue).toBeCloseTo(6275.182689240253, 6);
    });
  });
});
