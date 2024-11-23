import * as alias from './alias';
import * as deleteEmailSubscription from './delete-email-subscription';
import * as deleteProposal from './delete-proposal';
import * as deleteSpace from './delete-space';
import * as emailSubscription from './email-subscription';
import * as flagProposal from './flag-proposal';
import * as follow from './follow';
import * as profile from './profile';
import * as proposal from './proposal';
import * as settings from './settings';
import * as statement from './statement';
import * as subscribe from './subscribe';
import * as unfollow from './unfollow';
import * as unsubscribe from './unsubscribe';
import * as updateProposal from './update-proposal';
import * as vote from './vote';

export default {
  proposal,
  vote,
  settings,
  'delete-space': deleteSpace,
  'delete-proposal': deleteProposal,
  'update-proposal': updateProposal,
  'flag-proposal': flagProposal,
  follow,
  unfollow,
  subscribe,
  unsubscribe,
  'email-subscription': emailSubscription,
  'delete-email-subscription': deleteEmailSubscription,
  alias,
  profile,
  statement
};
