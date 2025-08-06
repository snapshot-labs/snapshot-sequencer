import { getProposalValue } from '../../../src/helpers/entityValue';

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
});
