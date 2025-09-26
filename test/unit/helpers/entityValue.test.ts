import { getProposalValue, getVoteValue } from '../../../src/helpers/entityValue';

describe('getProposalValue', () => {
  it('should calculate correct proposal value with single strategy', () => {
    const proposal = {
      scores_by_strategy: [[100], [200]],
      vp_value_by_strategy: [2.5]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(750); // (100 + 200) * 2.5 = 300 * 2.5 = 750
  });

  it('should calculate correct proposal value with multiple strategies', () => {
    const proposal = {
      scores_by_strategy: [
        [100, 50],
        [200, 75],
        [300, 25]
      ],
      vp_value_by_strategy: [1.5, 3.0]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(1350); // (100+200+300)*1.5 + (50+75+25)*3.0 = 600*1.5 + 150*3.0 = 900 + 450 = 1350
  });

  it('should return 0 when scores_by_strategy is empty', () => {
    const proposal = {
      scores_by_strategy: [],
      vp_value_by_strategy: [2.0]
    };

    const result = getProposalValue(proposal);
    expect(result).toBe(0);
  });

  it('should return 0 when first strategy array is empty', () => {
    const proposal = {
      scores_by_strategy: [[]],
      vp_value_by_strategy: [2.0]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(0);
  });

  it('should return 0 when vp_value_by_strategy is empty', () => {
    const proposal = {
      scores_by_strategy: [[100], [200]],
      vp_value_by_strategy: []
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(0);
  });

  it('should handle zero values correctly', () => {
    const proposal = {
      scores_by_strategy: [
        [0, 0],
        [0, 0]
      ],
      vp_value_by_strategy: [2.0, 1.5]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(0);
  });

  it('should handle zero vp_value_by_strategy correctly', () => {
    const proposal = {
      scores_by_strategy: [
        [100, 50],
        [200, 75]
      ],
      vp_value_by_strategy: [0, 0]
    };

    const result = getProposalValue(proposal);
    expect(result).toBe(0);
  });

  it('should handle decimal values correctly', () => {
    const proposal = {
      scores_by_strategy: [
        [10.5, 20.5],
        [15.5, 25.5]
      ],
      vp_value_by_strategy: [0.1, 0.2]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(11.8); // (10.5+15.5)*0.1 + (20.5+25.5)*0.2 = 26*0.1 + 46*0.2 = 2.6 + 9.2 = 11.8
  });

  it('should handle single vote scenario', () => {
    const proposal = {
      scores_by_strategy: [[100]],
      vp_value_by_strategy: [2.0]
    };

    const result = getProposalValue(proposal);

    expect(result).toBe(200); // 100 * 2.0 = 200
  });

  it('should throw on array size mismatch', () => {
    const proposal = {
      scores_by_strategy: [
        [100, 50], // 2 strategies
        [200, 75] // 2 strategies
      ],
      vp_value_by_strategy: [1.5] // Only 1 strategy value
    };

    expect(() => getProposalValue(proposal)).toThrow(
      'Array size mismatch: voteScores length does not match vp_value_by_strategy length'
    );
  });

  it('should throw on invalid score value', () => {
    const proposal = {
      scores_by_strategy: [
        [100, 'invalid'], // Invalid string value
        [200, 75]
      ],
      vp_value_by_strategy: [1.5, 2.0]
    } as any;

    expect(() => getProposalValue(proposal)).toThrow(
      'Invalid score value: expected number, got string'
    );
  });

  it('should throw on invalid vp_value', () => {
    const proposal = {
      scores_by_strategy: [
        [100, 50],
        [200, 75]
      ],
      vp_value_by_strategy: [1.5, 'invalid'] // Invalid string value
    } as any;

    expect(() => getProposalValue(proposal)).toThrow(
      'Invalid vp_value: expected number, got string'
    );
  });
});

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
