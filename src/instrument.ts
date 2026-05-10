import { initLogger } from '@snapshot-labs/snapshot-sentry';

initLogger({ ignoreErrors: ['unauthorized'] });
