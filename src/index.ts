import 'dotenv/config';
import cors from 'cors';
import { initLogger, fallbackLogger } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import api from './api';
import rateLimit from './helpers/rateLimit';
import shutter from './helpers/shutter';
import log from './helpers/log';
import refreshModeration from './helpers/moderation';
import initMetrics from './helpers/metrics';

const app = express();

initLogger(app);
refreshModeration();
initMetrics(app);

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
