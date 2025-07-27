import log from './log';
import db from './mysql';
import { fetchTokenPrices } from './overlord';

export interface Strategy {
  name: string;
  params: {
    address?: string;
    network?: string;
    [key: string]: any;
  };
}

interface Proposal {
  strategies: Strategy[];
  network: string;
}

interface VoteRecord {
  vp_by_strategy: string;
}

async function storeVotePrice(voteId: string, usdValue: number): Promise<void> {
  try {
    const created = Math.floor(Date.now() / 1000);
    const insertQuery = `
      INSERT IGNORE INTO vote_prices (vote_id, usd_value, created)
      VALUES (?, ?, ?)
    `;

    await db.queryAsync(insertQuery, [voteId, usdValue, created]);
    log.info(`[votePrice] Stored USD value $${usdValue} for vote ${voteId}`);
  } catch (error) {
    log.error('[votePrice] Failed to store vote USD value:', error);
    throw error;
  }
}

export async function assignVotePrices(
  proposal: Proposal,
  voteId: string,
  voteTimestamp: number
): Promise<void> {
  try {
    const tokenPrices = await fetchTokenPrices(
      proposal.strategies,
      proposal.network,
      voteTimestamp
    );

    const voteQuery = 'SELECT vp_by_strategy FROM votes WHERE id = ?';
    const voteResults = (await db.queryAsync(voteQuery, [voteId])) as VoteRecord[];

    if (voteResults.length === 0) {
      log.warn(`[votePrice] Vote ${voteId} not found`);
      return;
    }

    const vpByStrategy: number[] = JSON.parse(voteResults[0].vp_by_strategy);

    if (vpByStrategy.length !== tokenPrices.length) {
      log.warn(`[votePrice] Mismatch between strategies and VP array lengths for vote ${voteId}`);
      return;
    }

    // Calculate total vote value: sum of (voting power × token price) for each strategy
    let totalVoteValue = 0;
    for (let i = 0; i < tokenPrices.length; i++) {
      const tokenPrice = tokenPrices[i];
      const votingPower = vpByStrategy[i] || 0;
      totalVoteValue += votingPower * tokenPrice;
    }

    if (totalVoteValue > 0) {
      await storeVotePrice(voteId, totalVoteValue);
    }
  } catch (error) {
    log.warn(`[votePrice] Failed to assign prices to vote ${voteId}:`, error);
  }
}
