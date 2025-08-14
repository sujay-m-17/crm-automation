require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Zoho CRM configuration
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    redirectUri: process.env.ZOHO_REDIRECT_URI,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    baseURL: 'https://www.zohoapis.com/crm/v3',
    authURL: 'https://accounts.zoho.in/oauth/v2'
  },
  
  // Gemini AI configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // CORS configuration
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001']
  },
  
  // Slack configuration
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  }
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    'zoho.clientId',
    'zoho.clientSecret',
    'zoho.refreshToken',
    'gemini.apiKey',
    'jwt.secret'
  ];
  
  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    return !value;
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
};

// Validate config in development
if (config.nodeEnv === 'development') {
  try {
    validateConfig();
  } catch (error) {
    console.warn('⚠️  Configuration warning:', error.message);
  }
}

module.exports = config; 