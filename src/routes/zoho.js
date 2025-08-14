const express = require('express');
const router = express.Router();
const zohoService = require('../services/zohoService');

// Get authorization URL
router.get('/auth', (req, res) => {
  try {
    const authURL = zohoService.getAuthURL();
    res.json({
      success: true,
      authURL: authURL,
      message: 'Use this URL to authorize the application'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const tokens = await zohoService.exchangeCodeForTokens(code);

    res.json({
      success: true,
      message: 'Authentication successful',
      tokens: {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Refresh access token
router.post('/auth/refresh', async (req, res) => {
  try {
    const tokens = await zohoService.refreshAccessToken();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      tokens: {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Validate token
router.get('/auth/validate', async (req, res) => {
  try {
    const isValid = await zohoService.validateToken();

    res.json({
      success: true,
      isValid: isValid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get lead metadata to check field names
router.get('/leads/metadata', async (req, res) => {
  try {
    const metadata = await zohoService.getLeadMetadata();

    res.json({
      success: true,
      metadata: metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 