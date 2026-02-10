import express from 'express';
import {
  handleESIMStatusWebhook,
  handlePaymentCallback,
  handleActivationCompleteWebhook,
  handleGenericWebhook
} from '../controllers/webhookController';

const router = express.Router();

// POST /api/webhooks/esim/status - Handle eSIM status updates from Cellcard
router.post('/esim/status', handleESIMStatusWebhook);

// POST /api/webhooks/payment/callback - Handle payment callbacks (alternative route)
router.post('/payment/callback', handlePaymentCallback);

// POST /api/webhooks/activation/complete - Handle activation completion
router.post('/activation/complete', handleActivationCompleteWebhook);

// POST /api/webhooks/generic - Generic webhook handler for any event type
router.post('/generic', handleGenericWebhook);

export default router;
