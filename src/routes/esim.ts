import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { getPlans, purchaseESIM, activateESIM, paymentCallback } from '../controllers/esimController';

const router = express.Router();

// GET /api/esim/plans - Public route
router.get('/plans', getPlans);

// POST /api/esim/purchase - Protected route
router.post('/purchase', authenticateToken, purchaseESIM);

// GET /api/esim/activate/:transactionId - Protected route
router.get('/activate/:transactionId', authenticateToken, activateESIM);

// POST /api/esim/payment/callback - Public route for WingPay callbacks
router.post('/payment/callback', paymentCallback);

export default router;
