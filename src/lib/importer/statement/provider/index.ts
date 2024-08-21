import intersection from 'lodash/intersection';
import * as agora from './agora';
import * as karmahq from './karmahq';
import * as tally from './tally';
import { DelegateMeta } from '../';

export type ProviderType = 'tally' | 'agora' | 'karmahq';
interface ProviderInterface {
  fetchSpaceDelegates: (spaceId: string) => Promise<DelegateMeta[]>;
  MAPPING: Record<string, string | Record<string, string>>;
}

export const PROVIDERS: Record<ProviderType, ProviderInterface> = {
  tally,
  agora,
  karmahq
};

export async function run(
  providers: ProviderType[],
  spaces?: string[]
): Promise<Record<ProviderType, Record<string, DelegateMeta[]>>> {
  const results = await Promise.all(
    providers.map(async (providerId: string) => {
      const provider: ProviderInterface = PROVIDERS[providerId];
      const providerSpaces = Object.keys(provider.MAPPING);
      const spaceIds: string[] = intersection(spaces || providerSpaces, providerSpaces);

      const spaceResults = await Promise.all(
        spaceIds.map(spaceId => {
          return provider.fetchSpaceDelegates(spaceId);
        })
      );

      return Object.fromEntries(spaceResults.map((result, i) => [spaceIds[i], result]));
    })
  );

  return Object.fromEntries(results.map((result, i) => [providers[i], result])) as Record<
    ProviderType,
    Record<string, DelegateMeta[]>
  >;
}
