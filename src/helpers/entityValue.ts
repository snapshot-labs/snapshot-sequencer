type Proposal = {
  scores_by_strategy: string;
  vp_value_by_strategy: string;
};

/**
 * Calculates the total proposal value based on the vote's total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(proposal: Proposal): number {
  const scoresByStrategy: number[][] = JSON.parse(proposal.scores_by_strategy);
  const vpValueByStrategy: number[] = JSON.parse(proposal.vp_value_by_strategy);

  return (
    scoresByStrategy[0]
      ?.map((_, index) => scoresByStrategy.reduce((sum, array) => sum + array[index], 0))
      ?.map((value, index) => value * vpValueByStrategy[index])
      ?.reduce((sum, value) => sum + value, 0) || 0
  );
}
