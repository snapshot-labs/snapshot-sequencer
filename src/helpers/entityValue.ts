type Proposal = {
  scores_by_strategy: number[][];
  vp_value_by_strategy: number[];
};

/**
 * Calculates the proposal total value based on all votes' total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(proposal: Proposal): number {
  const { scores_by_strategy, vp_value_by_strategy } = proposal;

  if (
    !scores_by_strategy.length ||
    !scores_by_strategy[0]?.length ||
    !vp_value_by_strategy.length
  ) {
    return 0;
  }

  let totalValue = 0;
  for (let strategyIndex = 0; strategyIndex < vp_value_by_strategy.length; strategyIndex++) {
    const strategyTotal = scores_by_strategy.reduce((sum, voteScores) => {
      if (voteScores.length !== vp_value_by_strategy.length) {
        throw new Error(
          'Array size mismatch: voteScores length does not match vp_value_by_strategy length'
        );
      }
      const score = voteScores[strategyIndex];
      if (typeof score !== 'number') {
        throw new Error(`Invalid score value: expected number, got ${typeof score}`);
      }
      return sum + score;
    }, 0);

    if (typeof vp_value_by_strategy[strategyIndex] !== 'number') {
      throw new Error(
        `Invalid vp_value: expected number, got ${typeof vp_value_by_strategy[strategyIndex]}`
      );
    }

    totalValue += strategyTotal * vp_value_by_strategy[strategyIndex];
  }

  return totalValue;
}
