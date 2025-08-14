# CRM Automation Backend

A Node.js backend for CRM automation that integrates Zoho CRM with Google Gemini AI to generate comprehensive brand overviews for companies.

## Features

- **Zoho CRM Integration**: OAuth2 authentication, get and update company data
- **Gemini AI Integration**: Web scraping and geolocation analysis
- **Brand Overview Generation**: Automated company analysis and insights
- **RESTful API**: Complete API endpoints for all operations
- **Security**: Rate limiting, CORS, and helmet security middleware

## Prerequisites

- Node.js (v16 or higher)
- Zoho CRM account with API access
- Google Gemini AI API key

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crm-automation-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your credentials:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Zoho CRM Configuration
   ZOHO_CLIENT_ID=your_zoho_client_id
   ZOHO_CLIENT_SECRET=your_zoho_client_secret
   ZOHO_REDIRECT_URI=http://localhost:3000/api/zoho/auth/callback
   ZOHO_REFRESH_TOKEN=your_zoho_refresh_token
   ZOHO_ACCESS_TOKEN=your_zoho_access_token

   # Google Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_api_key

   # JWT Secret for authentication
   JWT_SECRET=your_jwt_secret_key_here
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Zoho CRM Setup

1. **Create Zoho App**
   - Go to [Zoho Developer Console](https://api-console.zoho.com/)
   - Create a new client
   - Set redirect URI: `http://localhost:3000/api/zoho/auth/callback`
   - Note down Client ID and Client Secret

2. **Get Access Token**
   - Visit: `http://localhost:3000/api/zoho/auth`
   - Follow the OAuth flow
   - Save the refresh token in your `.env` file

## API Endpoints

### Health Check
```
GET /health
```

### Zoho CRM Endpoints

#### Authentication
```
GET /api/zoho/auth                    # Get authorization URL
GET /api/zoho/auth/callback           # OAuth callback
POST /api/zoho/auth/refresh           # Refresh access token
GET /api/zoho/auth/validate           # Validate token
```

#### Companies
```
GET /api/zoho/companies               # Get all companies
GET /api/zoho/companies/:id           # Get company by ID
GET /api/zoho/companies/:id/with-website  # Get company with website info
PUT /api/zoho/companies/:id           # Update company
GET /api/zoho/companies/search/:term  # Search companies
```

### Gemini AI Endpoints

```
POST /api/gemini/scrape              # Scrape website
POST /api/gemini/analyze             # Analyze company
POST /api/gemini/geolocation         # Get geolocation info
POST /api/gemini/brand-overview      # Generate brand overview
```

### Brand Overview Endpoints

```
POST /api/brand-overview/generate/:companyId     # Generate for specific company
POST /api/brand-overview/generate-batch          # Generate for multiple companies
POST /api/brand-overview/update/:companyId       # Update with brand overview
GET /api/brand-overview/companies-with-websites  # Get companies with websites
POST /api/brand-overview/search-and-generate     # Search and generate
```

## Usage Examples

### 1. Generate Brand Overview for a Company

```bash
curl -X POST http://localhost:3000/api/brand-overview/generate/123456789 \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "123456789",
      "name": "Example Corp",
      "website": "https://example.com",
      "industry": "Technology"
    },
    "analysis": {
      "overview": "Example Corp is a technology company...",
      "mission": "To provide innovative solutions...",
      "products": ["Software", "Consulting"],
      "targetMarket": "Enterprise businesses",
      "differentiators": ["AI-powered", "Cloud-native"],
      "brandPositioning": "Leading technology innovator",
      "companySize": "500+ employees",
      "technology": ["React", "Node.js", "AWS"],
      "recentNews": ["Series A funding", "New product launch"]
    },
    "geolocation": {
      "headquarters": "San Francisco, CA",
      "offices": ["New York", "London", "Tokyo"],
      "serviceAreas": ["North America", "Europe", "Asia"],
      "markets": ["US", "UK", "Japan"],
      "regions": ["West Coast", "East Coast", "International"]
    },
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Search and Generate Brand Overviews

```bash
curl -X POST http://localhost:3000/api/brand-overview/search-and-generate \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "tech",
    "searchField": "Company_Name"
  }'
```

### 3. Handle Insufficient Data Response

When insufficient data is detected, the API returns a special response:

```bash
curl -X POST http://localhost:3000/api/brand-overview/generate/123456789 \
  -H "Content-Type: application/json"
```

**Response when insufficient data is found:**
```json
{
  "success": true,
  "insufficientData": true,
  "data": {
    "company": {
      "id": "123456789",
      "name": "Tech Corp",
      "website": "https://example.com"
    },
    "reason": "Company name is too generic and no website data available",
    "suggestions": [
      "Please verify the company name is correct and complete",
      "Please provide a valid website URL for the company",
      "Ensure the company name is not too generic (e.g., 'Tech Corp', 'ABC Company')",
      "Check for any spelling errors in the company name"
    ],
    "message": "Please enter the correct company name and website URL to generate a comprehensive brand overview.",
    "overview": "DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL"
  }
}
```

**Client-side handling example:**
```javascript
const response = await fetch('/api/brand-overview/generate/123456789', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const result = await response.json();

if (result.insufficientData) {
  // Show user-friendly message with suggestions
  console.log('Insufficient data detected:', result.data.message);
  console.log('Suggestions:', result.data.suggestions);
  
  // Prompt user to enter correct information
  // You can show a form to collect the correct company name and website
} else {
  // Process normal brand overview data
  console.log('Brand overview:', result.data);
}
```

### 4. Update Company with Brand Overview

```bash
curl -X POST http://localhost:3000/api/brand-overview/update/123456789 \
  -H "Content-Type: application/json" \
  -d '{
    "updateFields": {
      "Description": "Updated company description with AI insights"
    }
  }'
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Insufficient Data Handling

When the system cannot find sufficient data for a company (due to incorrect company name, missing website, or generic company names), it returns a special response:

```json
{
  "success": true,
  "insufficientData": true,
  "data": {
    "company": {
      "id": "123456789",
      "name": "Tech Corp",
      "website": "https://example.com"
    },
    "reason": "Company name is too generic and no website data available",
    "suggestions": [
      "Please verify the company name is correct and complete",
      "Please provide a valid website URL for the company",
      "Ensure the company name is not too generic (e.g., 'Tech Corp', 'ABC Company')",
      "Check for any spelling errors in the company name"
    ],
    "message": "Please enter the correct company name and website URL to generate a comprehensive brand overview.",
    "overview": "DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL"
  }
}
```

**When insufficient data is detected:**
- Company name is too generic (e.g., "Tech Corp", "ABC Company", "Test Company")
- Company name appears to be misspelled or incorrect
- No website provided AND no relevant data found in other sources
- Website content is completely unrelated to the company name
- All data sources return empty or irrelevant results

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

The API includes rate limiting to prevent abuse:
- 100 requests per 15 minutes per IP address
- Configurable via environment variables

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Request validation
- **Error Handling**: Secure error responses

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
├── index.js                 # Main entry point
├── src/                     # Source code
│   ├── server.js           # Express server setup
│   ├── config/             # Configuration
│   │   └── index.js       # Centralized config
│   ├── middleware/         # Express middleware
│   │   ├── errorHandler.js # Error handling
│   │   └── notFound.js    # 404 handler
│   ├── routes/             # API routes
│   │   ├── zoho.js        # Zoho CRM routes
│   │   ├── gemini.js      # Gemini AI routes
│   │   └── brandOverview.js # Brand overview routes
│   ├── services/           # Business logic
│   │   ├── zohoService.js # Zoho CRM integration
│   │   └── geminiService.js # Gemini AI integration
│   └── utils/              # Utility functions
│       ├── logger.js       # Logging utility
│       └── validation.js   # Input validation
├── test/                   # Test files
│   └── test.js            # Basic functionality tests
├── package.json            # Dependencies
└── README.md              # Documentation
```

## Troubleshooting

### Common Issues

1. **Zoho Authentication Error**
   - Verify client ID and secret
   - Check redirect URI configuration
   - Ensure refresh token is valid

2. **Gemini API Error**
   - Verify API key is correct
   - Check API quota limits
   - Ensure proper request format

3. **Web Scraping Issues**
   - Some websites block scraping
   - Check website accessibility
   - Verify URL format

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 