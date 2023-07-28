import * as proposal from './proposal';
import * as vote from './vote';
import * as settings from './settings';
import * as deleteSpace from './delete-space';
import * as deleteProposal from './delete-proposal';
import * as follow from './follow';
import * as unfollow from './unfollow';
import * as alias from './alias';
import * as subscribe from './subscribe';
import * as unsubscribe from './unsubscribe';
import * as profile from './profile';
import * as statement from './statement';

export default {
  proposal,
  vote,
  settings,
  'delete-space': deleteSpace,
  'delete-proposal': deleteProposal,
  follow,
  unfollow,
  subscribe,
  unsubscribe,
  alias,
  profile,
  statement
};
