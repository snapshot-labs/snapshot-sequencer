import { z } from 'zod';

const BaseMessage = z.object({
  from: z.string(),
  timestamp: z.number()
});

export const AliasMessage = BaseMessage.extend({
  alias: z.string()
});

export const DeleteProposalMessage = BaseMessage.extend({
  space: z.string(),
  proposal: z.string()
});

export const DeleteSpaceMessage = BaseMessage.extend({
  space: z.string()
});

export const FlagProposalMessage = BaseMessage.extend({
  space: z.string(),
  proposal: z.string()
});

export const FollowMessage = BaseMessage.extend({
  space: z.string()
});
export type FollowMessage = z.infer<typeof FollowMessage>;

export const ProfileMessage = BaseMessage.extend({
  profile: z.string()
});
export type ProfileMessage = z.infer<typeof ProfileMessage>;

export const ProposalMessage = BaseMessage.extend({
  space: z.string(),
  title: z.string().min(1).max(256),
  body: z.string().max(20000), // TODO: handle turbo/default
  discussion: z.string().optional(),
  choices: z.array(z.string()).min(1).max(500),
  type: z.enum([
    'single-choice',
    'approval',
    'ranked-choice',
    'quadratic',
    'weighted',
    'custom',
    'basic'
  ]),
  snapshot: z.number(),
  start: z.number().min(1000000000).max(2000000000),
  end: z.number().min(1000000000).max(2000000000),
  plugins: z.string(),
  app: z.string().max(24).optional()
});

export const SettingsMessage = BaseMessage.extend({
  settings: z.string()
});

export const StatementMessage = BaseMessage.extend({
  space: z.string(),
  about: z.string(),
  statement: z.string().optional()
});

export const SubscribeMessage = BaseMessage.extend({
  space: z.string()
});
export type SubscribeMessage = z.infer<typeof SubscribeMessage>;

export const UpdateProposal = ProposalMessage.omit({
  snapshot: true,
  start: true,
  end: true,
  app: true
}).extend({
  proposal: z.string()
});

export const UnfollowMessage = BaseMessage.extend({
  space: z.string()
});
export type UnfollowMessage = z.infer<typeof UnfollowMessage>;

export const UnsubscribeMessage = BaseMessage.extend({
  space: z.string()
});
export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessage>;

export const BaseVoteMessage = BaseMessage.extend({
  space: z.string(),
  proposal: z.string(),
  choice: z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.object({}).passthrough(),
    z.array(z.number())
  ]),
  reason: z.string().max(140).optional(),
  metadata: z.string().max(2000).optional(),
  app: z.string().max(24).optional()
});

export const VoteArrayMessage = BaseVoteMessage.extend({
  choice: z.array(z.string())
});

export const VoteStringMessage = BaseVoteMessage.extend({
  choice: z.string()
});

const MessageUnion = z.discriminatedUnion('type', [
  z.object({ type: z.literal('alias'), message: AliasMessage }),
  z.object({ type: z.literal('delete-proposal'), message: DeleteProposalMessage }),
  z.object({ type: z.literal('delete-space'), message: DeleteSpaceMessage }),
  z.object({ type: z.literal('flag-proposal'), message: FlagProposalMessage }),
  z.object({ type: z.literal('follow'), message: FollowMessage }),
  z.object({ type: z.literal('profile'), message: ProfileMessage }),
  z.object({ type: z.literal('proposal'), message: ProposalMessage }),
  z.object({ type: z.literal('settings'), message: SettingsMessage }),
  z.object({ type: z.literal('statement'), message: StatementMessage }),
  z.object({ type: z.literal('subscribe'), message: SubscribeMessage }),
  z.object({ type: z.literal('unfollow'), message: UnfollowMessage }),
  z.object({ type: z.literal('unsubscribe'), message: UnsubscribeMessage }),
  z.object({ type: z.literal('update-proposal'), message: UpdateProposal }),
  z.object({ type: z.literal('vote'), message: BaseVoteMessage }),
  z.object({ type: z.literal('vote-string'), message: VoteStringMessage }),
  z.object({ type: z.literal('vote-array'), message: VoteArrayMessage })
]);

export const InitialEnvelope = z.object({
  address: z.string(),
  data: z.object({
    domain: z.object({
      name: z.string(),
      version: z.string()
    }),
    types: z.any(),
    primaryType: z.string().optional()
  }),
  sig: z.string()
});

export const Envelope = InitialEnvelope.extend({
  data: InitialEnvelope.shape.data.and(MessageUnion)
});
