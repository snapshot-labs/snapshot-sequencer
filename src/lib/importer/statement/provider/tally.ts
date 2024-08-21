import snapshot from '@snapshot-labs/snapshot.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { VariableType } from 'json-to-graphql-query';
import { DelegateMeta } from '../';

// NOTE: Disabling spaces without delegates with statement
export const MAPPING = {
  's:arbitrumfoundation.eth': 'arbitrum',
  's:uniswapgovernance.eth': 'uniswap',
  's:dopedao.eth': 'dopewars', // 2 results
  's:opcollective.eth': 'optimism',
  's:ens.eth': 'ens',
  's:aave.eth': 'aave',
  's:gitcoindao.eth': 'gitcoin', // 153 results
  's:hop.eth': 'hop', // 41 results
  's:gmx.eth': 'gmx', // 32 results
  // 's:fei.eth': 'fei', // no results
  // 's:eulerdao.eth': 'euler', // no results
  's:yam.eth': 'yam-finance', // 1 result
  // 's:fuse.eth': 'rari-capital', // no results
  // 's:truefigov.eth': 'truefi', // no results
  's:idlefinance.eth': 'idle' // 1 result
  // 's:instadapp-gov.eth': 'instadapp', // no results
  // 's:anglegovernance.eth': 'angle' // no results
};

const DELEGATES_QUERY = {
  __variables: {
    input: 'DelegatesInput!'
  },
  delegates: {
    __args: {
      input: new VariableType('input')
    },
    nodes: {
      __on: {
        __typeName: 'Delegate',
        id: true,
        account: {
          address: true
        },
        statement: {
          statement: true
        }
      }
    },
    pageInfo: {
      firstCursor: true,
      lastCursor: true
    }
  }
};

const ORGANIZATION_QUERY = {
  __variables: {
    input: 'OrganizationInput!'
  },
  organization: {
    __args: {
      input: new VariableType('input')
    },
    governorIds: true,
    id: true
  }
};

export async function fetchSpaceDelegates(spaceId: string): Promise<DelegateMeta[]> {
  const delegates: DelegateMeta[] = [];
  const spaceMeta = await fetchSpaceMeta(spaceId);
  let afterCursor: string | undefined;
  let page = 0;

  while (true) {
    console.log(`[tally] Fetching page ${page} for ${spaceId}`);

    const variables: Record<string, any> = {
      input: {
        filters: {
          governorId: spaceMeta.governorId,
          organizationId: spaceMeta.organizationId
        },
        sort: {
          isDescending: true,
          sortBy: 'votes'
        },
        page: {
          limit: 20
        }
      }
    };

    if (afterCursor) variables.input.page.afterCursor = afterCursor;

    const results = await snapshot.utils.subgraphRequest(
      'https://api.tally.xyz/query',
      DELEGATES_QUERY,
      {
        variables,
        headers: { 'Api-Key': process.env.TALLY_API_KEY }
      }
    );

    if (!results.delegates.nodes.length) break;

    results.delegates.nodes.forEach((node: any) => {
      const statement = node.statement.statement.trim();

      if (statement) {
        delegates.push({
          address: node.account.address,
          statement
        });
      }
    });

    if (!results.delegates.pageInfo.lastCursor) break;

    afterCursor = results.delegates.pageInfo.lastCursor;
    page++;

    await snapshot.utils.sleep(1000);
  }

  console.log(
    `[tally] Found ${Object.keys(delegates).length} ${spaceId} delegates with statement\n`
  );

  return delegates;
}

export async function fetchSpaceMeta(
  spaceId: string
): Promise<{ governorId: string; organizationId: string }> {
  const variables = {
    input: {
      slug: MAPPING[spaceId]
    }
  };

  const result = await snapshot.utils.subgraphRequest(
    'https://api.tally.xyz/query',
    ORGANIZATION_QUERY,
    {
      variables,
      headers: { 'Api-Key': process.env.TALLY_API_KEY }
    }
  );

  return {
    organizationId: result.organization.id,
    governorId: result.organization.governorIds[0]
  };
}
