import { Request, Response } from 'express';
import { query } from '../config/database';

// Webhook controller for handling callbacks from Cellcard and other services

export const handleESIMStatusWebhook = async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    const { esim_id, status, iccid, imsi, error_message } = webhookData;

    console.log('eSIM status webhook received:', webhookData);

    // Validate webhook data
    if (!esim_id && !iccid) {
      res.status(400).json({ error: 'eSIM ID or ICCID is required' });
      return;
    }

    // Find the eSIM profile
    let profileQuery;
    let profileParams;

    if (esim_id) {
      profileQuery = 'SELECT * FROM esim_profiles WHERE id = $1';
      profileParams = [esim_id];
    } else {
      profileQuery = 'SELECT * FROM esim_profiles WHERE iccid = $1';
      profileParams = [iccid];
    }

    const profileResult = await query(profileQuery, profileParams);

    if (profileResult.rows.length === 0) {
      console.warn('eSIM profile not found for webhook:', webhookData);
      res.status(404).json({ error: 'eSIM profile not found' });
      return;
    }

    const profile = profileResult.rows[0];

    // Update eSIM status
    const validStatuses = ['pending', 'activated', 'suspended', 'terminated'];
    const newStatus = validStatuses.includes(status) ? status : profile.status;

    await query(`
      UPDATE esim_profiles
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [newStatus, profile.id]);

    // If activated, update activation timestamp
    if (newStatus === 'activated' && !profile.activated_at) {
      await query(`
        UPDATE esim_profiles
        SET activated_at = NOW()
        WHERE id = $1
      `, [profile.id]);
    }

    // Log the status change
    console.log(`eSIM ${profile.iccid} status updated to ${newStatus}`);

    // Here you could trigger additional actions:
    // - Send push notifications via Firebase
    // - Update user dashboard
    // - Send SMS/email notifications
    // - Trigger billing updates

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      esim_id: profile.id,
      status: newStatus
    });

  } catch (error) {
    console.error('eSIM status webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const handlePaymentCallback = async (req: Request, res: Response) => {
  // This is handled in esimController, but keeping here for completeness
  // Redirect to the existing payment callback
  return handleESIMStatusWebhook(req, res);
};

export const handleActivationCompleteWebhook = async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    const { transaction_id, activation_code, qr_url } = webhookData;

    console.log('Activation complete webhook received:', webhookData);

    if (!transaction_id) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    // Find transaction
    const transactionResult = await query('SELECT * FROM transactions WHERE transaction_id = $1', [transaction_id]);

    if (transactionResult.rows.length === 0) {
      console.warn('Transaction not found for activation webhook:', transaction_id);
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const transaction = transactionResult.rows[0];

    // Update transaction if needed
    if (transaction.status !== 'completed') {
      await query(`
        UPDATE transactions
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
      `, [transaction.id]);
    }

    // Here you could:
    // - Send activation confirmation to user
    // - Update eSIM profile with real activation data
    // - Trigger welcome email/SMS

    res.json({
      success: true,
      message: 'Activation webhook processed successfully',
      transaction_id,
      activation_code,
      qr_url
    });

  } catch (error) {
    console.error('Activation webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const handleGenericWebhook = async (req: Request, res: Response) => {
  try {
    const eventType = req.headers['x-webhook-event'] as string || 'generic';
    const webhookData = req.body;

    console.log(`Generic webhook received (${eventType}):`, webhookData);

    // Store webhook data for processing
    await query(`
      INSERT INTO webhooks (event_type, payload, created_at)
      VALUES ($1, $2, NOW())
    `, [eventType, JSON.stringify(webhookData)]);

    // Process based on event type
    switch (eventType) {
      case 'esim_provisioned':
        // Handle eSIM provisioning
        break;
      case 'payment_completed':
        // Handle payment completion
        break;
      case 'user_verification':
        // Handle user verification updates
        break;
      default:
        console.log('Unknown webhook event type:', eventType);
    }

    res.json({
      success: true,
      message: 'Webhook received and queued for processing'
    });

  } catch (error) {
    console.error('Generic webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
