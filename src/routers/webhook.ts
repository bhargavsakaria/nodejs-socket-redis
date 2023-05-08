import express from 'express';

import * as webhookController from '../controllers/webhook';

const router = express.Router();

router.post('/stripe', express.raw({ type: '*/*' }), webhookController.stripeWebhook);

export default router;
