import 'dotenv/config';
import { fallbackLogger, initLogger } from '@snapshot-labs/snapshot-sentry';
import cors from 'cors';
import express from 'express';
import api from './api';
import log from './helpers/log';
import initMetrics from './helpers/metrics';
import refreshModeration from './helpers/moderation';
import rateLimit from './helpers/rateLimit';
import shutter from './helpers/shutter';
import { run as refreshStrategies } from './helpers/strategies';
import { trackTurboStatuses } from './helpers/turbo';

const app = express();

initLogger(app);
refreshModeration();
refreshStrategies();
initMetrics(app);
trackTurboStatuses();

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use(rateLimit);
app.set('trust proxy', 1);
app.use('/', api);
app.use('/shutter', shutter);

fallbackLogger(app);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => log.info(`Started on: http://localhost:${PORT}`));
