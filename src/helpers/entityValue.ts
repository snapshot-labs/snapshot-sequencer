export function getVoteValue(proposal, vote) {
  if (proposal.vp_value_by_strategy.length !== vote.vp_by_strategy.length) {
    throw new Error('invalid data to compute vote value');
  }

  return proposal.vp_value_by_strategy.map((value, index) => value * vote.vp_by_strategy[index]);
}
