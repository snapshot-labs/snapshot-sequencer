import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { z } from 'zod';
import log from './log';
import db from './mysql';
import { CB } from '../constants';

type Datum = {
  id: string;
  vpState: string;
  vpByStrategy: number[];
  vpValueByStrategy: number[];
};

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 100;

const datumSchema = z
  .object({
    id: z.string(),
    vpState: z.string(),
    vpValueByStrategy: z.array(z.number().finite()),
    vpByStrategy: z.array(z.number().finite())
  })
  .refine(data => data.vpValueByStrategy.length === data.vpByStrategy.length, {
    message: 'Array length mismatch: vpValueByStrategy and vpByStrategy must have the same length'
  });

async function getProposalIds(): Promise<{ id: string; vpValueByStrategy: number[] }[]> {
  const query = `
    SELECT id, vp_value_by_strategy
    FROM proposals
    WHERE cb IN (?) AND votes > 0`;
  const results = await db.queryAsync(query, [[CB.PENDING_FINAL, CB.PENDING_COMPUTE, CB.FINAL]]);

  return results.map((r: any) => ({
    id: r.id,
    vpValueByStrategy: JSON.parse(r.vp_value_by_strategy)
  }));
}

async function getVotes(proposalId: string, vpValueByStrategy: number[]): Promise<Datum[]> {
  const query = `
    SELECT id, vp_state, vp_by_strategy
    FROM votes
    WHERE cb = ? AND proposal = ?
    LIMIT ?`;
  const results = await db.queryAsync(query, [CB.PENDING_COMPUTE, proposalId, BATCH_SIZE]);

  return results.map((r: any) => ({
    id: r.id,
    vpState: r.vp_state,
    vpValueByStrategy,
    vpByStrategy: JSON.parse(r.vp_by_strategy)
  }));
}

async function refreshVotesVpValues(data: Datum[]) {
  if (!data.length) return;

  const query: string[] = [];
  const params: any[] = [];

  for (const datum of data) {
    query.push('UPDATE votes SET vp_value = ?, cb = ? WHERE id = ? LIMIT 1');

    try {
      const validatedDatum = datumSchema.parse(datum);
      const value = validatedDatum.vpValueByStrategy.reduce(
        (sum, value, index) => sum + value * validatedDatum.vpByStrategy[index],
        0
      );

      params.push(
        value,
        validatedDatum.vpState === 'final' ? CB.FINAL : CB.PENDING_FINAL,
        validatedDatum.id
      );
    } catch (e) {
      capture(e);
      params.push(0, CB.INELIGIBLE, datum.id);
    }
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

export default async function run() {
  log.info('[votesVpValue] Start votesVpValue refresh loop');

  while (true) {
    log.info('[votesVpValue] Start refresh');

    const proposals = await getProposalIds();

    log.info(`[votesVpValue] Found ${proposals.length} proposals`);

    for (const proposal of proposals) {
      while (true) {
        const votes = await getVotes(proposal.id, proposal.vpValueByStrategy);

        await refreshVotesVpValues(votes);

        if (votes.length < BATCH_SIZE) {
          break;
        }
      }
    }

    log.info(`[votesVpValue] End refresh`);

    await snapshot.utils.sleep(REFRESH_INTERVAL);
  }
}
