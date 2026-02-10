import express from 'express';
import { authenticateToken } from '../middleware/auth';
import proxyService from '../services/proxyService';

const router = express.Router();

// Test proxy with Cellcard eSIM API - Protected route
router.post('/test/esim', authenticateToken, async (req, res) => {
  try {
    const { endpoint, method = 'GET', data } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    const result = await proxyService.callCellcardESIMApi(endpoint, method as 'GET' | 'POST', data);

    res.json({
      success: result.status < 400,
      proxyResponse: result
    });
  } catch (error: any) {
    console.error('Proxy test error:', error);
    res.status(500).json({ error: 'Proxy test failed', message: error.message });
  }
});

// Test proxy with Cellcard eKYC API - Protected route
router.post('/test/ekyc', authenticateToken, async (req, res) => {
  try {
    const { endpoint, method = 'POST', data } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    const result = await proxyService.callCellcardEKYCApi(endpoint, method as 'GET' | 'POST', data);

    res.json({
      success: result.status < 400,
      proxyResponse: result
    });
  } catch (error: any) {
    console.error('eKYC proxy test error:', error);
    res.status(500).json({ error: 'eKYC proxy test failed', message: error.message });
  }
});

// General proxy test - Protected route
router.post('/test/general', authenticateToken, async (req, res) => {
  try {
    const { url, method = 'GET', headers, data, params } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    const result = await proxyService.proxyToCellcard({
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      url,
      headers,
      data,
      params
    });

    res.json({
      success: result.status < 400,
      proxyResponse: result
    });
  } catch (error: any) {
    console.error('General proxy test error:', error);
    res.status(500).json({ error: 'General proxy test failed', message: error.message });
  }
});

// Start MITM proxy server - Admin route (should be protected in production)
router.post('/start/mitm', authenticateToken, async (req, res) => {
  try {
    const { port = 8080 } = req.body;

    proxyService.startMITMProxy(port);

    res.json({
      message: `MITM Proxy started on port ${port}`,
      note: 'Configure your device proxy settings to intercept Cellcard traffic'
    });
  } catch (error: any) {
    console.error('MITM proxy start error:', error);
    res.status(500).json({ error: 'Failed to start MITM proxy', message: error.message });
  }
});

export default router;
