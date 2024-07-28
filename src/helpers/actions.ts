import { ensNormalize } from '@ethersproject/hash';
import snapshot from '@snapshot-labs/snapshot.js';
import db from './mysql';
import { DEFAULT_NETWORK_ID, jsonParse, NETWORK_ID_WHITELIST } from './utils';

export async function addOrUpdateSpace(space: string, settings: any) {
  if (!settings?.name) return false;

  const ts = (Date.now() / 1e3).toFixed();
  const query =
    'INSERT INTO spaces SET ? ON DUPLICATE KEY UPDATE updated = ?, settings = ?, name = ?, hibernated = 0';

  await db.queryAsync(query, [
    {
      id: space,
      name: settings.name,
      created: ts,
      updated: ts,
      settings: JSON.stringify(settings)
    },
    ts,
    JSON.stringify(settings),
    settings.name
  ]);
}

export async function getProposal(space, id) {
  const query = `SELECT * FROM proposals WHERE space = ? AND id = ?`;
  const [proposal] = await db.queryAsync(query, [space, id]);
  if (!proposal) return false;

  proposal.strategies = jsonParse(proposal.strategies);
  proposal.validation = jsonParse(proposal.validation, { name: 'any', params: {} }) || {
    name: 'any',
    params: {}
  };
  proposal.choices = jsonParse(proposal.choices);

  return proposal;
}

export async function getSpace(id: string, includeDeleted = false, network = DEFAULT_NETWORK_ID) {
  if (NETWORK_ID_WHITELIST.includes(network) && network !== DEFAULT_NETWORK_ID) {
    const spaceExist = await sxSpaceExists(network, id);
    if (!spaceExist) return false;

    return {
      network: 0
    };
  }

  try {
    if (ensNormalize(id) !== id.toLowerCase()) return false;
  } catch (e) {
    return false;
  }

  const query = `SELECT settings, deleted, flagged, verified, turbo, hibernated FROM spaces WHERE id = ? AND deleted in (?) LIMIT 1`;
  const spaces = await db.queryAsync(query, [id.toLowerCase(), includeDeleted ? [0, 1] : [0]]);

  if (!spaces[0]) return false;

  return {
    ...jsonParse(spaces[0].settings, {}),
    deleted: spaces[0].deleted === 1,
    verified: spaces[0].verified === 1,
    flagged: spaces[0].flagged === 1,
    hibernated: spaces[0].hibernated === 1,
    turbo: spaces[0].turbo === 1
  };
}

export async function sxSpaceExists(network: string, spaceId: string): Promise<boolean> {
  const urls = {
    eth: 'https://api.studio.thegraph.com/query/23545/sx/version/latest',
    sep: 'https://api.studio.thegraph.com/query/23545/sx-sepolia/version/latest',
    matic: 'https://api.studio.thegraph.com/query/23545/sx-polygon/version/latest',
    arb1: 'https://api.studio.thegraph.com/query/23545/sx-arbitrum/version/latest',
    oeth: 'https://api.studio.thegraph.com/query/23545/sx-optimism/version/latest',
    sn: 'https://api-1.snapshotx.xyz',
    'sn-sep': 'https://testnet-api-1.snapshotx.xyz',
    'linea-testnet':
      'https://thegraph.goerli.zkevm.consensys.net/subgraphs/name/snapshot-labs/sx-subgraph'
  };

  if (!urls[network]) throw new Error(`network ${network} is not allowed`);

  const { space } = await snapshot.utils.subgraphRequest(urls[network], {
    space: {
      __args: {
        id: spaceId
      },
      id: true
    }
  });
  return !!space?.id;
}
