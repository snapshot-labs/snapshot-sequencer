import log from './log';
import db from './mysql';
import { fetchTokenPrices } from './overlord';

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

export async function assignVotePrices(proposal: any, voteId: string): Promise<void> {
  try {
    const tokenPrices = await fetchTokenPrices(
      proposal.strategies,
      proposal.network,
      proposal.snapshot
    );

    const totalPrice = tokenPrices.reduce((sum, price) => sum + price, 0);
    if (totalPrice > 0) {
      await storeVotePrice(voteId, totalPrice);
    }
  } catch (error) {
    log.warn(`[votePrice] Failed to assign prices to vote ${voteId}:`, error);
  }
}
