import express from 'express';
import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateLPACode } from '../services/esimService';
import wingpayService from '../services/wingpayService';

interface PurchaseRequest {
  planId: number;
  paymentMethod: string;
  paymentInfo: any;
}

export const getPlans = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, name, data_limit, validity_days, price_usd, price_khr
      FROM plans
      WHERE active = true
      ORDER BY price_usd ASC
    `);

    res.json({
      plans: result.rows
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const purchaseESIM = async (req: Request, res: Response) => {
  try {
    const { planId, paymentMethod, paymentInfo }: PurchaseRequest = req.body;
    const userId = (req as any).user?.userId; // Assuming auth middleware sets this

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!planId || !paymentMethod) {
      res.status(400).json({ error: 'Plan ID and payment method are required' });
      return;
    }

    // Get plan details
    const planResult = await query('SELECT * FROM plans WHERE id = $1 AND active = true', [planId]);

    if (planResult.rows.length === 0) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const plan = planResult.rows[0] as { id: number; name: string; data_limit: string; validity_days: number; price_usd: number; price_khr: number; active: boolean };

    // Process payment
    const paymentResult = await processPayment(paymentMethod, paymentInfo, plan);

    if (!paymentResult.success) {
      res.status(400).json({ error: 'Payment failed', details: paymentResult.error });
      return;
    }

    // Create transaction
    const transactionResult = await query(`
      INSERT INTO transactions (user_id, plan_id, amount_usd, payment_method, payment_reference, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
      RETURNING id, transaction_id
    `, [userId, planId, plan.price_usd, paymentMethod, paymentResult.reference]);

    const transaction = transactionResult.rows[0] as { id: number; transaction_id: string; user_id: number; plan_id: number; amount_usd: number; payment_method: string; payment_reference: string; status: string; created_at: string; updated_at: string };

    res.json({
      message: 'Purchase successful',
      transactionId: transaction.transaction_id,
      plan: {
        name: plan.name,
        dataLimit: plan.data_limit,
        validity: plan.validity_days
      }
    });
  } catch (error) {
    console.error('Purchase eSIM error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const activateESIM = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get transaction
    const transactionResult = await query(`
      SELECT t.*, p.name as plan_name
      FROM transactions t
      JOIN plans p ON t.plan_id = p.id
      WHERE t.transaction_id = $1 AND t.user_id = $2 AND t.status = 'completed'
    `, [transactionId, userId]);

    if (transactionResult.rows.length === 0) {
      res.status(404).json({ error: 'Transaction not found or not completed' });
      return;
    }

    const transaction = transactionResult.rows[0] as { id: number; transaction_id: string; user_id: number; plan_id: number; amount_usd: number; payment_method: string; payment_reference: string; status: string; created_at: string; updated_at: string };

    // Check if eSIM profile already exists
    const existingProfile = await query('SELECT * FROM esim_profiles WHERE transaction_id = $1', [transaction.id]);

    if (existingProfile.rows.length > 0) {
      const profile = existingProfile.rows[0] as { id: number; user_id: number; transaction_id: number; iccid: string; imsi: string; status: string; activated_at: string; created_at: string; updated_at: string };
      const lpaCode = generateLPACode(profile.iccid, profile.imsi);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lpaCode)}`;

      res.json({
        lpaCode,
        qrCodeUrl,
        esimProfile: {
          iccid: profile.iccid,
          imsi: profile.imsi,
          status: profile.status
        }
      });
      return;
    }

    // Generate new eSIM profile
    const iccid = generateICCID();
    const imsi = generateIMSI();

    // Insert eSIM profile
    await query(`
      INSERT INTO esim_profiles (user_id, transaction_id, iccid, imsi, status, activated_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW())
    `, [userId, transaction.id, iccid, imsi]);

    // Generate LPA code
    const lpaCode = generateLPACode(iccid, imsi);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lpaCode)}`;

    res.json({
      lpaCode,
      qrCodeUrl,
      esimProfile: {
        iccid,
        imsi,
        status: 'pending'
      }
    });
    return;
  } catch (error) {
    console.error('Activate eSIM error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions
async function processPayment(paymentMethod: string, paymentInfo: any, plan: any): Promise<{success: boolean, reference?: string, error?: string}> {
  if (paymentMethod === 'wingpay') {
    try {
      const paymentRequest = {
        amount: plan.price_usd,
        currency: 'USD',
        description: `eSIM Plan: ${plan.name}`,
        customerPhone: paymentInfo.phone,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/esim/payment/callback`
      };

      const result = await wingpayService.initiatePayment(paymentRequest);

      if (result.success) {
        const response: { success: boolean; reference?: string; error?: string } = {
          success: true
        };
        if (result.transactionId) {
          response.reference = result.transactionId;
        }
        return response;
      } else {
        const response: { success: boolean; reference?: string; error?: string } = {
          success: false
        };
        if (result.error) {
          response.error = result.error;
        }
        return response;
      }
    } catch (error: any) {
      console.error('WingPay payment error:', error);
      return {
        success: false,
        error: 'Payment service temporarily unavailable'
      };
    }
  } else {
    // For other payment methods, use simulation
    return {
      success: true,
      reference: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
}

function generateICCID(): string {
  // Generate fake ICCID (19 digits)
  const prefix = '890126'; // Cellcard prefix
  const random = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
  return prefix + random;
}

function generateIMSI(): string {
  // Generate fake IMSI (15 digits)
  const prefix = '45601'; // Cellcard prefix
  const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  return prefix + random;
}

export const paymentCallback = async (req: Request, res: Response) => {
  try {
    const callbackData = req.body;

    // Log the callback for debugging
    console.log('WingPay payment callback received:', callbackData);

    // Extract transaction information from callback
    const { transaction_id, status, amount } = callbackData;

    if (!transaction_id) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    // Update transaction status in database
    const updateResult = await query(`
      UPDATE transactions
      SET status = $1, updated_at = NOW()
      WHERE transaction_id = $2
      RETURNING id, user_id, plan_id, status
    `, [status === 'completed' ? 'completed' : 'failed', transaction_id]);

    if (updateResult.rows.length === 0) {
      console.warn('Transaction not found for callback:', transaction_id);
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const transaction = updateResult.rows[0];

    // If payment completed, we could trigger additional actions here
    // like sending notifications, activating services, etc.

    console.log('Transaction updated via callback:', transaction);

    // Respond to WingPay
    res.json({
      success: true,
      message: 'Callback processed successfully'
    });

  } catch (error) {
    console.error('Payment callback error:', error);
    // Still return success to WingPay to avoid retries
    res.status(200).json({
      success: true,
      message: 'Callback received but processing failed'
    });
  }
};
