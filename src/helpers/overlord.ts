import supportedStrategies from '@snapshot-labs/overlord';
import log from './log';

export async function fetchTokenPrices(
  strategies: any[],
  network: string,
  blockNumber: number
): Promise<number[]> {
  const pricePromises = strategies.map(async strategy => {
    if (!supportedStrategies[strategy.name]) {
      log.info(`[overlord] Strategy ${strategy.name} not supported for pricing`);
      return 0;
    }

    if (!strategy.params?.address) {
      log.warn(`[overlord] No token address found for strategy ${strategy.name}`);
      return 0;
    }

    const strategyNetwork = strategy.params.network || network;
    const strategyNetworkId = parseInt(strategyNetwork);

    if (isNaN(strategyNetworkId)) {
      log.info(
        `[overlord] Skipping strategy ${strategy.name} - non-numeric network: ${strategyNetwork}`
      );
      return 0;
    }

    try {
      const tokenAddress = strategy.params.address;
      const strategyFunction = supportedStrategies[strategy.name];

      const price = await strategyFunction(
        { ...strategy.params, address: tokenAddress },
        strategyNetworkId,
        blockNumber
      );

      if (price > 0) {
        log.info(`[overlord] Fetched price for ${strategy.name}: ${tokenAddress} = $${price}`);
        return price;
      }

      return 0;
    } catch (error) {
      log.warn(
        `[overlord] Failed to fetch price for strategy ${strategy.name}, token ${strategy.params?.address}:`,
        error
      );
      return 0;
    }
  });

  return Promise.all(pricePromises);
}
