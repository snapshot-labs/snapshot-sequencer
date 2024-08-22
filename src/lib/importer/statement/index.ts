import intersection from 'lodash/intersection';
import { PROVIDERS } from './provider';

const DEFAULT_PROVIDERS = Object.keys(PROVIDERS);

export type Delegate = {
  delegate: string;
  statement: string;
  source: string;
  space: string;
  network: string;
};

export default async function main(providers = DEFAULT_PROVIDERS, spaces?: string[]) {
  const providerParams = buildParams(providers, spaces);
  const providerInstances = providerParams
    .map(({ providerId, spaceIds }) => spaceIds.map(spaceId => new PROVIDERS[providerId](spaceId)))
    .flat();

  await Promise.all([
    ...providerInstances.filter(p => !p.throttled()).map(p => p.fetch()),
    throttle(providerInstances.filter(p => p.throttled()))
  ]);
}

async function throttle(instances: any): Promise<any> {
  for (const instance of instances) {
    await instance.fetch();
  }

  return;
}

function buildParams(providers: string[], spaces?: string[]) {
  return providers.map(providerId => {
    const providerClass = PROVIDERS[providerId];

    if (!providerClass) throw new Error(`Unknown provider: ${providerId}`);

    const spaceIds: string[] = intersection(
      spaces || providerClass.availableSpaces,
      providerClass.availableSpaces
    );

    return { providerId, spaceIds };
  });
}