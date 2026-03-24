import * as strategies from '../../../src/helpers/strategies';
import { hasStrategyOverride } from '../../../src/helpers/utils';

const OVERRIDING_STRATEGIES = ['delegation', 'delegation-with-cap'];

// Mock the getOverridingStrategies function
jest.mock('../../../src/helpers/strategies');
const mockGetOverridingStrategies = jest.mocked(strategies.getOverridingStrategies);

describe('Utils', () => {
  describe('hasStrategyOverride()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockGetOverridingStrategies.mockReturnValue(OVERRIDING_STRATEGIES);
    });

    it('should return false when strategies array is empty', () => {
      expect(hasStrategyOverride([])).toBe(false);
    });

    it('should return false when no overriding strategies exist', () => {
      const strategies = [
        { name: 'whitelist', network: '1', params: {} },
        { name: 'ticket', network: '1', params: {} }
      ];

      expect(hasStrategyOverride(strategies)).toBe(false);
    });

    it('should return true when an overriding strategy is used', () => {
      const strategies = [
        { name: 'whitelist', network: '1', params: {} },
        { name: 'delegation', network: '1', params: {} }
      ];

      expect(hasStrategyOverride(strategies)).toBe(true);
    });

    it('should return true when multiple overriding strategies are used', () => {
      const strategies = [
        { name: 'delegation', network: '1', params: {} },
        { name: 'delegation-with-cap', network: '1', params: {} }
      ];

      expect(hasStrategyOverride(strategies)).toBe(true);
    });

    it('should handle mixed case strategy names correctly', () => {
      const strategies = [{ name: 'Delegation', network: '1', params: {} }];

      expect(hasStrategyOverride(strategies)).toBe(true);
    });

    it('should handle inner strategies', () => {
      const strategies = [
        {
          name: 'multichain',
          network: '1',
          params: {
            symbol: 'MULTI',
            strategies: [
              {
                name: 'erc20-balance-of',
                network: '1',
                params: {
                  address: '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9',
                  decimals: 18
                }
              },
              {
                name: 'delegation',
                network: '137',
                params: {
                  delegationSpace: 'test.eth',
                  strategies: [
                    {
                      name: 'erc20-balance-of',
                      params: {
                        address: '0xB9638272aD6998708de56BBC0A290a1dE534a578',
                        decimals: 18
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ];

      expect(hasStrategyOverride(strategies)).toBe(true);
    });

    it('should not match when strategy id appears in other fields', () => {
      const strategies = [
        {
          name: 'whitelist',
          network: '1',
          params: { description: 'delegation' }
        }
      ];

      expect(hasStrategyOverride(strategies)).toBe(false);
    });

    it('should handle empty getOverridingStrategies result', () => {
      mockGetOverridingStrategies.mockReturnValue([]);

      const strategies = [{ name: 'delegation', network: '1', params: {} }];

      expect(hasStrategyOverride(strategies)).toBe(false);
    });
  });
});
