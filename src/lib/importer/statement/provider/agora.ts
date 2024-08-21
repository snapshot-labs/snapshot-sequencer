import snapshot from '@snapshot-labs/snapshot.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { VariableType } from 'json-to-graphql-query';
import { DelegateMeta } from '../';

export const MAPPING = {
  // NOTE: disabling pages not using graphql api
  // 's:ens.eth': 'https://agora.ensdao.org',
  // 's:opcollective.eth': 'https://vote.optimism.io',
  // 's:uniswapgovernance.eth': 'https://vote.uniswapfoundation.org',
  's:lyra.eth': 'https://vote.lyra.finance'
};

const QUERY = {
  __variables: {
    orderBy: 'DelegatesOrder!',
    seed: 'String!',
    statement: 'StatementFilter',
    first: 'Int!'
  },
  delegates: {
    __args: {
      first: new VariableType('first'),
      seed: new VariableType('seed'),
      orderBy: new VariableType('orderBy'),
      where: { statement: new VariableType('statement') }
    },
    edges: {
      node: {
        id: true,
        address: {
          resolvedName: {
            address: true,
            name: true
          }
        },
        statement: {
          summary: true,
          twitter: true,
          discord: true
        }
      },
      cursor: true
    },
    pageInfo: {
      endCursor: true,
      hasNextPage: true
    }
  }
};

export async function fetchSpaceDelegates(spaceId: string): Promise<DelegateMeta[]> {
  const variables = {
    orderBy: 'mostVotingPower',
    statement: 'withStatement',
    seed: Date.now().toString(),
    first: 30
  };

  const results = await snapshot.utils.subgraphRequest(`${MAPPING[spaceId]}/graphql`, QUERY, {
    variables
  });
  const delegates = results.delegates.edges.map((edge: any) => {
    return {
      address: edge.node.address.resolvedName.address,
      statement: edge.node.statement.summary.trim()
    };
  });

  return delegates;
}
