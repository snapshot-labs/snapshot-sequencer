import { getVoteValue } from '../../../src/helpers/entityValue';

describe('getVoteValue', () => {
  it('should calculate correct vote value with single strategy', () => {
    const proposal = { vp_value_by_strategy: [2.5] };
    const vote = { vp_by_strategy: [100] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(250);
  });

  it('should calculate correct vote value with multiple strategies', () => {
    const proposal = { vp_value_by_strategy: [1.5, 3.0, 0.5] };
    const vote = { vp_by_strategy: [100, 50, 200] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(400); // (1.5 * 100) + (3.0 * 50) + (0.5 * 200) = 150 + 150 + 100 = 400
  });

  it('should return 0 when vote has no voting power', () => {
    const proposal = { vp_value_by_strategy: [2.0, 1.5] };
    const vote = { vp_by_strategy: [0, 0] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(0);
  });

  it('should return 0 when proposal has no value per strategy', () => {
    const proposal = { vp_value_by_strategy: [0, 0] };
    const vote = { vp_by_strategy: [100, 50] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(0);
  });

  it('should handle decimal values correctly', () => {
    const proposal = { vp_value_by_strategy: [0.1, 0.25] };
    const vote = { vp_by_strategy: [10, 20] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(6); // (0.1 * 10) + (0.25 * 20) = 1 + 5 = 6
  });

  it('should throw error when strategy arrays have different lengths', () => {
    const proposal = { vp_value_by_strategy: [1.0, 2.0] };
    const vote = { vp_by_strategy: [100] };

    expect(() => getVoteValue(proposal, vote)).toThrow('invalid data to compute vote value');
  });

  it('should throw error when vote has more strategies than proposal', () => {
    const proposal = { vp_value_by_strategy: [1.0] };
    const vote = { vp_by_strategy: [100, 50] };

    expect(() => getVoteValue(proposal, vote)).toThrow('invalid data to compute vote value');
  });

  it('should handle empty arrays', () => {
    const proposal = { vp_value_by_strategy: [] };
    const vote = { vp_by_strategy: [] };

    const result = getVoteValue(proposal, vote);

    expect(result).toBe(0);
  });
});
