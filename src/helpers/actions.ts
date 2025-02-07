import snapshot from '@snapshot-labs/snapshot.js';
import db from './mysql';
import { DEFAULT_NETWORK_ID, jsonParse, NETWORK_ID_WHITELIST } from './utils';

function normalizeSettings(settings: any) {
  const _settings = snapshot.utils.clone(settings);

  if (_settings.domain) {
    _settings.domain = _settings.domain?.replace(/(^\w+:|^)\/\//, '').replace(/\/$/, '');
  }
  if (_settings.delegationPortal) {
    _settings.delegationPortal = {
      delegationNetwork: '1',
      ..._settings.delegationPortal
    };
  }

  delete _settings.skinSettings;

  return _settings;
}

export async function addOrUpdateSpace(id: string, settings: any) {
  if (!settings?.name) return false;

  const normalizedSettings = normalizeSettings(settings);

  const ts = (Date.now() / 1e3).toFixed();
  const query =
    'INSERT INTO spaces SET ? ON DUPLICATE KEY UPDATE updated = ?, settings = ?, name = ?, hibernated = 0, domain = ?';

  await db.queryAsync(query, [
    {
      id,
      name: settings.name,
      created: ts,
      updated: ts,
      settings: JSON.stringify(normalizedSettings),
      domain: normalizedSettings.domain || null
    },
    ts,
    JSON.stringify(normalizedSettings),
    settings.name,
    normalizedSettings.domain || null
  ]);

  await addOrUpdateSkin(id, settings.skinSettings);
}

export async function addOrUpdateSkin(id: string, skinSettings: Record<string, string>) {
  if (!skinSettings) return false;

  const COLORS = [
    'bg_color',
    'link_color',
    'text_color',
    'content_color',
    'border_color',
    'heading_color',
    'primary_color',
    'header_color'
  ];

  await db.queryAsync(
    `INSERT INTO skins
      SET ?
      ON DUPLICATE KEY UPDATE
        ${COLORS.map(color => `${color} = ?`).join(',')},
        theme = COALESCE(VALUES(theme), theme)
    `,
    [
      {
        id,
        ...skinSettings
      },
      ...COLORS.map(color => skinSettings[color]),
      skinSettings.theme
    ]
  );
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

  const query = `SELECT settings, domain, deleted, flagged, verified, turbo, hibernated FROM spaces WHERE id = ? AND deleted in (?) LIMIT 1`;
  const spaces = await db.queryAsync(query, [id.toLowerCase(), includeDeleted ? [0, 1] : [0]]);

  if (!spaces[0]) return false;

  return {
    ...jsonParse(spaces[0].settings, {}),
    domain: spaces[0].domain || undefined,
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
    base: 'https://api.studio.thegraph.com/query/23545/sx-base/version/latest',
    sn: 'https://api.snapshot.box',
    'sn-sep': 'https://testnet-api.snapshot.box',
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
