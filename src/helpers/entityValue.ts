type Vote = {
  vp_by_strategy: number[];
};

type Proposal = {
  vp_value_by_strategy: number[];
};

/**
 * Calculates the total vote value based on the voting power and the proposal's value per strategy.
 * @returns The total vote value, in the currency unit specified by the proposal's vp_value_by_strategy values
 **/
export function getVoteValue(proposal: Proposal, vote: Vote): number {
  if (proposal.vp_value_by_strategy.length !== vote.vp_by_strategy.length) {
    throw new Error('invalid data to compute vote value');
  }

  return proposal.vp_value_by_strategy.reduce(
    (sum, value, index) => sum + value * vote.vp_by_strategy[index],
    0
  );
}
