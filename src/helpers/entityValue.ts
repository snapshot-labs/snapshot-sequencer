type Proposal = {
  scores_by_strategy: number[][];
  vp_value_by_strategy: number[];
};

/**
 * Calculates the total proposal value based on the vote's total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(proposal: Proposal): number {
  return (
    proposal.scores_by_strategy[0]
      ?.map((_, index) => proposal.scores_by_strategy.reduce((sum, array) => sum + array[index], 0))
      ?.map((value, index) => value * proposal.vp_value_by_strategy[index])
      ?.reduce((sum, value) => sum + value, 0) || 0
  );
}
