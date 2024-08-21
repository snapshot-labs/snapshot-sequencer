import { PROVIDERS, ProviderType, run } from './provider';

const DEFAULT_PROVIDERS = Object.keys(PROVIDERS);

export type DelegateMeta = {
  address: string;
  statement: string;
};

export type Delegate = {
  delegate: string;
  statement: string;
  source: string;
  space: string;
  network: string;
};

export default async function main(providers = DEFAULT_PROVIDERS, spaces?: string[]) {
  providers.forEach(provider => {
    if (!PROVIDERS[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
  });

  const delegatesMeta = await fetchDelegates(providers as ProviderType[], spaces);
  const delegates: Delegate[] = formatDelegates(delegatesMeta);
  importDelegates(delegates);
}

function fetchDelegates(
  providers: ProviderType[],
  spaces?: string[]
): Promise<Record<ProviderType, Record<string, DelegateMeta[]>>> {
  return run(providers, spaces);
}

function formatDelegates(
  results: Record<ProviderType, Record<string, DelegateMeta[]>>
): Delegate[] {
  const data: Delegate[] = [];

  Object.keys(results).forEach(provider => {
    Object.keys(results[provider]).forEach(space => {
      const delegates = results[provider][space];
      const [spaceId, spaceNetwork] = space.split(':');

      delegates.forEach((delegate: DelegateMeta) => {
        data.push({
          delegate: delegate.address,
          statement: delegate.statement.trim(),
          source: provider,
          space: spaceId,
          network: spaceNetwork
        });
      });
    });
  });

  return data;
}

function importDelegates(data: Delegate[]) {}
