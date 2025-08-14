const axios = require('axios');
const config = require('../config');

class SlackService {
  constructor() {
    this.webhookUrl = config.slack.webhookUrl;
  }

  // Send error notification to Slack
  async sendErrorNotification(error, context) {
    try {
      if (!this.webhookUrl) {
        console.warn('⚠️ SLACK_WEBHOOK_URL not configured, skipping Slack notification');
        return;
      }

      const message = this.formatErrorMessage(error, context);
      
      const payload = {
        text: message,
        unfurl_links: false
      };

      await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ Slack error notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error.message);
    }
  }

  // Format error message for Slack
  formatErrorMessage(error, context) {
    const timestamp = new Date().toISOString();
    const errorType = this.getErrorType(error);
    
    let message = `🚨 *CRM Automation Error Alert*\n\n`;
    message += `*Error Type:* ${errorType}\n`;
    message += `*Timestamp:* ${timestamp}\n`;
    message += `*Environment:* ${process.env.NODE_ENV || 'development'}\n\n`;

    // Add context-specific information
    if (context.leadId) {
      message += `*Lead ID:* ${context.leadId}\n`;
    }
    if (context.company) {
      message += `*Company:* ${context.company}\n`;
    }
    if (context.website) {
      message += `*Website:* ${context.website}\n`;
    }
    if (context.step) {
      message += `*Failed Step:* ${context.step}\n`;
    }

    message += `\n*Error Details:*\n\`\`\`${error.message || error}\`\`\`\n`;

    // Add actionable information
    message += `\n*Recommended Actions:*\n`;
    message += `• Check server logs for detailed error information\n`;
    message += `• Verify API credentials and configurations\n`;
    message += `• Check if external services (Gemini AI, Zoho CRM) are accessible\n`;
    message += `• Review the specific lead data for any anomalies\n`;

    // Add severity indicator
    const severity = this.getSeverityLevel(error);
    message += `\n*Severity:* ${severity}\n`;

    return message;
  }

  // Determine error type for better categorization
  getErrorType(error) {
    if (error.message?.includes('Gemini')) return 'AI Analysis Failure';
    if (error.message?.includes('Zoho')) return 'CRM Update Failure';
    if (error.message?.includes('insufficient data')) return 'Data Quality Issue';
    if (error.message?.includes('rate limit')) return 'Rate Limiting Issue';
    if (error.message?.includes('authentication')) return 'Authentication Error';
    if (error.message?.includes('timeout')) return 'Timeout Error';
    if (error.message?.includes('network')) return 'Network Error';
    return 'General Error';
  }

  // Determine severity level
  getSeverityLevel(error) {
    if (error.message?.includes('authentication') || error.message?.includes('credentials')) {
      return '🔴 HIGH - Requires immediate attention';
    }
    if (error.message?.includes('rate limit') || error.message?.includes('timeout')) {
      return '🟡 MEDIUM - Temporary issue, may resolve itself';
    }
    if (error.message?.includes('insufficient data')) {
      return '🟢 LOW - Data quality issue, not critical';
    }
    return '🟡 MEDIUM - Requires investigation';
  }


}

module.exports = new SlackService(); 