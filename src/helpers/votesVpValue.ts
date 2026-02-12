import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { z } from 'zod';
import log from './log';
import db from './mysql';
import { CB } from '../constants';

type ProposalVpValues = Map<string, number[]>;

type Datum = {
  id: string;
  vpState: string;
  vpByStrategy: number[];
  vpValueByStrategy: number[];
};

const REFRESH_INTERVAL = 10 * 1000;
const DEFAULT_BATCH_SIZE = 1000;
const PROPOSALS_BATCH_SIZE = 50000;

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

async function getPendingVotes(): Promise<
  { id: string; proposal: string; vpState: string; vpByStrategy: number[] }[]
> {
  const query = `
    SELECT id, proposal, vp_state, vp_by_strategy
    FROM votes
    WHERE cb = ?
    LIMIT ?`;
  const results = await db.queryAsync(query, [CB.PENDING_COMPUTE, DEFAULT_BATCH_SIZE]);

  return results.map((r: any) => ({
    id: r.id,
    proposal: r.proposal,
    vpState: r.vp_state,
    vpByStrategy: JSON.parse(r.vp_by_strategy)
  }));
}

async function getProposalVpValues(): Promise<ProposalVpValues> {
  const map: ProposalVpValues = new Map();
  let lastId = '';

  while (true) {
    const query = `
      SELECT id, vp_value_by_strategy
      FROM proposals
      WHERE cb IN (?) AND votes > 0 AND id > ?
      ORDER BY id
      LIMIT ?`;
    const results = await db.queryAsync(query, [
      [CB.PENDING_COMPUTE, CB.PENDING_FINAL, CB.FINAL],
      lastId,
      PROPOSALS_BATCH_SIZE
    ]);

    if (results.length === 0) break;

    for (const r of results) {
      map.set(r.id, JSON.parse(r.vp_value_by_strategy));
    }

    lastId = results[results.length - 1].id;

    if (results.length < PROPOSALS_BATCH_SIZE) break;
  }

  return map;
}

async function refreshVotesVpValues(data: Datum[]) {
  if (!data.length) return;

  const query: string[] = [];
  const params: (number | string)[] = [];

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

async function processBatch(proposalVpValues: ProposalVpValues): Promise<number> {
  const votes = await getPendingVotes();
  if (!votes.length) return 0;

  const data: Datum[] = votes
    .filter(v => proposalVpValues.has(v.proposal))
    .map(v => ({
      id: v.id,
      vpState: v.vpState,
      vpByStrategy: v.vpByStrategy,
      vpValueByStrategy: proposalVpValues.get(v.proposal)!
    }));

  await refreshVotesVpValues(data);

  return votes.length;
}

// Ignored/filtered out votes still count as processed
async function processAllBatches(proposalVpValues: ProposalVpValues): Promise<number> {
  let totalProcessed = 0;
  let processed = DEFAULT_BATCH_SIZE;

  while (processed === DEFAULT_BATCH_SIZE) {
    processed = await processBatch(proposalVpValues);
    totalProcessed += processed;
  }

  return totalProcessed;
}

export default async function run() {
  while (true) {
    log.info('[votesVpValue] Start refresh');

    const proposalVpValues = await getProposalVpValues();
    log.info(`[votesVpValue] Found ${proposalVpValues.size} eligible proposals`);

    const totalProcessed = await processAllBatches(proposalVpValues);

    log.info(`[votesVpValue] ${totalProcessed} votes processed, sleeping`);
    await snapshot.utils.sleep(REFRESH_INTERVAL);
  }
}
