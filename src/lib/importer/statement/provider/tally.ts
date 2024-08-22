import snapshot from '@snapshot-labs/snapshot.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { VariableType } from 'json-to-graphql-query';
import { Provider } from './Provider';
import { Delegate } from '../';

const API_URL = 'https://api.tally.xyz/query';

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

export default class Tally extends Provider {
  // NOTE: Disabling spaces without delegates with statement
  static MAPPING = {
    's:arbitrumfoundation.eth': 'arbitrum',
    's:uniswapgovernance.eth': 'uniswap',
    's:dopedao.eth': 'dopewars', // 2 results
    's:opcollective.eth': 'optimism',
    's:ens.eth': 'ens', // 581 results
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
    // 's:instadapp-gov.eth': 'instadapp' // no results
    // 's:anglegovernance.eth': 'angle' // no results
  };

  static ID = 'tally';

  throttle_interval = 1000;

  async _fetch() {
    const spaceMeta = await this.spaceMeta();

    let afterCursor: string | undefined;
    let page = 0;

    while (true) {
      this.beforeFetchPage(page);

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

      const results = await snapshot.utils.subgraphRequest(API_URL, DELEGATES_QUERY, {
        variables,
        headers: { 'Api-Key': process.env.TALLY_API_KEY }
      });

      if (!results.delegates.nodes.length) break;

      const _delegates: Delegate[] = [];
      results.delegates.nodes.forEach((node: any) => {
        const statement = node.statement.statement.trim();

        if (!statement) return;

        _delegates.push(
          this.formatDelegate({
            delegate: node.account.address,
            statement
          })
        );
      });

      if (!results.delegates.pageInfo.lastCursor) break;

      afterCursor = results.delegates.pageInfo.lastCursor;
      page++;

      await this.afterFetchPage(page, _delegates);
    }
  }

  private async spaceMeta(): Promise<{ governorId: string; organizationId: string }> {
    const variables = {
      input: {
        slug: Tally.MAPPING[this.spaceId]
      }
    };

    const result = await snapshot.utils.subgraphRequest(API_URL, ORGANIZATION_QUERY, {
      variables,
      headers: { 'Api-Key': process.env.TALLY_API_KEY }
    });

    return {
      organizationId: result.organization.id,
      governorId: result.organization.governorIds[0]
    };
  }

  getId(): string {
    return Tally.ID;
  }

  getMapping() {
    return Tally.MAPPING;
  }

  static get availableSpaces(): string[] {
    return Object.keys(Tally.MAPPING);
  }
}
