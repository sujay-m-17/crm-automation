const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.primaryModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    this.fallbackModels = [
      this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
      this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
    ];
  }

  // Scrape website content
  async scrapeWebsite(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style').remove();
      
      // Extract text content
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // Extract meta tags
      const meta = {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content'),
        keywords: $('meta[name="keywords"]').attr('content'),
        ogTitle: $('meta[property="og:title"]').attr('content'),
        ogDescription: $('meta[property="og:description"]').attr('content'),
        ogImage: $('meta[property="og:image"]').attr('content')
      };

      // Extract additional structured data
      const structuredData = {
        // Look for schema.org markup
        organization: $('[itemtype*="Organization"]').text(),
        // Look for contact information
        contact: $('a[href^="mailto:"], a[href^="tel:"]').map((i, el) => $(el).text()).get(),
        // Look for social media links
        socialMedia: $('a[href*="facebook"], a[href*="linkedin"], a[href*="twitter"], a[href*="instagram"]').map((i, el) => $(el).attr('href')).get(),
        // Look for job postings or careers
        careers: $('a[href*="career"], a[href*="job"], a[href*="work"]').map((i, el) => $(el).text()).get(),
        // Look for partnership or RFPs
        partnerships: $('a[href*="partner"], a[href*="rfp"], a[href*="tender"]').map((i, el) => $(el).text()).get()
      };

      return { text, meta, url, structuredData };
    } catch (error) {
      console.error('Error scraping website:', error.message);
      throw new Error(`Failed to scrape website: ${error.message}`);
    }
  }

  // Enhanced data collection from multiple sources
  // Note: Reuters and Bloomberg removed due to consistent blocking. Some other sources may fail due to anti-scraping measures - this is expected behavior
  async collectEnhancedData(companyData, scrapedContent) {
    const enhancedData = {
      website: scrapedContent,
      socialMedia: {},
      businessDirectories: {},
      newsArticles: {},
      industryReports: {},
      financialData: {},
      legalData: {},
      reviews: {},
      techStack: {},
      marketingBudget: null,
      websiteTraffic: {}
    };

    const companyName = companyData.name;
    
    try {
      // 1. Social Media Scraping
      enhancedData.socialMedia = await this.scrapeSocialMedia(companyName);
      
      // 2. Business Directory Data
      enhancedData.businessDirectories = await this.scrapeBusinessDirectories(companyName);
      
      // 3. News and Press Releases
      enhancedData.newsArticles = await this.scrapeNewsArticles(companyName);
      
      // 4. Financial Data (if publicly available)
      enhancedData.financialData = await this.scrapeFinancialData(companyName);
      
      // 6. Legal/Corporate Data
      enhancedData.legalData = await this.scrapeLegalData(companyName);
      
      // 7. Customer Reviews and Ratings
      enhancedData.reviews = await this.scrapeReviews(companyName);
      
      // 8. Tech Stack Analysis
      enhancedData.techStack = await this.scrapeTechStack(companyData.website);
      
      // 9. Marketing Budget Analysis
      enhancedData.marketingBudget = await this.analyzeMarketingBudget(companyName, enhancedData);
      
      // 10. Website Traffic Analysis
      enhancedData.websiteTraffic = await this.getWebsiteTraffic(companyData.website);
      
    } catch (error) {
      console.error(`❌ Error in enhanced data collection: ${error.message}`);
    }

    return enhancedData;
  }

  // Scrape social media presence
  async scrapeSocialMedia(companyName) {
    try {
      const socialData = {
        linkedin: null,
        twitter: null,
        facebook: null,
        instagram: null,
        youtube: null
      };

      // LinkedIn company page
      try {
        const linkedinUrl = `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`;
        const response = await axios.get(linkedinUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        socialData.linkedin = { url: linkedinUrl, available: true };
      } catch (error) {
        socialData.linkedin = { available: false };
      }

      // Similar for other platforms...
      return socialData;
    } catch (error) {
      console.error(`❌ Social media scraping failed: ${error.message}`);
      return {};
    }
  }

  // Scrape business directories
  async scrapeBusinessDirectories(companyName) {
    try {
      const directoryData = {
        crunchbase: null,
        zoomInfo: null,
        linkedin: null,
        tofler: null,        // Indian company database
        zaubacorp: null,     // Indian company database
        mca: null            // Ministry of Corporate Affairs (India)
      };

      // Crunchbase (Global)
      try {
        const crunchbaseUrl = `https://www.crunchbase.com/organization/${companyName.toLowerCase().replace(/\s+/g, '-')}`;
        const response = await axios.get(crunchbaseUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        directoryData.crunchbase = { url: crunchbaseUrl, available: true };
      } catch (error) {
        directoryData.crunchbase = { available: false };
      }

      // LinkedIn (Global)
      try {
        const linkedinUrl = `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`;
        const response = await axios.get(linkedinUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        directoryData.linkedin = { url: linkedinUrl, available: true };
      } catch (error) {
        directoryData.linkedin = { available: false };
      }

      // Tofler (Indian company database)
      try {
        const toflerUrl = `https://tofler.in/search?q=${encodeURIComponent(companyName)}`;
        const response = await axios.get(toflerUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        directoryData.tofler = { url: toflerUrl, available: true };
      } catch (error) {
        directoryData.tofler = { available: false };
      }

      // Zaubacorp (Indian company database)
      try {
        const zaubacorpUrl = `https://www.zaubacorp.com/company-search/${encodeURIComponent(companyName)}`;
        const response = await axios.get(zaubacorpUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        directoryData.zaubacorp = { url: zaubacorpUrl, available: true };
      } catch (error) {
        directoryData.zaubacorp = { available: false };
      }

      return directoryData;
    } catch (error) {
      console.error(`❌ Business directory scraping failed: ${error.message}`);
      return {};
    }
  }

  // Scrape news articles
  // Note: Reuters and Bloomberg removed due to consistent 401/403 blocking
  async scrapeNewsArticles(companyName) {
    try {
      const newsData = {
        googleNews: [],
        economicTimes: [],    // Indian
        businessStandard: [], // Indian
        livemint: []         // Indian
      };
      // Google News search (Global)
      try {
        const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(companyName)}&hl=en&gl=US&ceid=US:en`;
        const response = await axios.get(googleNewsUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        // Parse news articles from response
        newsData.googleNews = [{ title: 'Recent news found', url: googleNewsUrl }];
      } catch (error) {
        // Google News often blocks scraping attempts - this is expected
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log(`ℹ️ Google News access blocked (expected): ${error.response.status}`);
        } else {
          console.error(`❌ Error scraping Google News: ${error.message}`);
        }
        newsData.googleNews = [];
      }





      return newsData;
    } catch (error) {
      console.error(`❌ News scraping failed: ${error.message}`);
      return {};
    }
  }



  // Scrape financial data
  async scrapeFinancialData(companyName) {
    try {
      const financialData = {
        yahooFinance: null,
        tofler: null,        // Indian
        moneyControl: null,  // Indian
        screener: null       // Indian
      };

      // Yahoo Finance (Global)
      try {
        const yahooFinanceUrl = `https://finance.yahoo.com/quote/${companyName.toUpperCase()}`;
        const response = await axios.get(yahooFinanceUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        financialData.yahooFinance = { url: yahooFinanceUrl, available: true };
      } catch (error) {
        financialData.yahooFinance = { available: false };
      }

      // MoneyControl (Indian financial data)
      try {
        const moneyControlUrl = `https://www.moneycontrol.com/india/stockpricequote/${encodeURIComponent(companyName)}`;
        const response = await axios.get(moneyControlUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        financialData.moneyControl = { url: moneyControlUrl, available: true };
      } catch (error) {
        financialData.moneyControl = { available: false };
      }

      return financialData;
    } catch (error) {
      console.error(`❌ Financial data scraping failed: ${error.message}`);
      return {};
    }
  }

  // Scrape legal/corporate data
  async scrapeLegalData(companyName) {
    try {
      const legalData = {
        mca: null,           // Ministry of Corporate Affairs
        zaubacorp: null,     // Indian company database
        tofler: null
      };

      // MCA (Ministry of Corporate Affairs)
      try {
        const mcaUrl = `https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do`;
        legalData.mca = { url: mcaUrl, available: true };
      } catch (error) {
        legalData.mca = { available: false };
      }

      return legalData;
    } catch (error) {
      console.error(`❌ Legal data scraping failed: ${error.message}`);
      return {};
    }
  }

  // Scrape customer reviews
  async scrapeReviews(companyName) {
    try {
      const reviewData = {
        googleReviews: [],
        glassdoor: [],
        ambitionBox: []
      };

      // Google Reviews
      try {
        const googleReviewsUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName)}+reviews`;
        const response = await axios.get(googleReviewsUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        reviewData.googleReviews = [{ company: companyName, url: googleReviewsUrl }];
      } catch (error) {
        console.error(`❌ Error scraping Google Reviews: ${error.message}`);
      }

      return reviewData;
    } catch (error) {
      console.error(`❌ Reviews scraping failed: ${error.message}`);
      return {};
    }
  }

  // Scrape tech stack from Wappalyzer and BuiltWith
  async scrapeTechStack(websiteUrl) {
    try {
      const techData = {
        wappalyzer: null,
        builtWith: null,
        technologies: [],
        primarySource: null
      };

      if (!websiteUrl || websiteUrl === 'undefined' || websiteUrl === 'No website available') {
        console.log(`ℹ️ No website URL provided for tech stack analysis - skipping tech stack`);
        return techData;
      }

      // Try Wappalyzer first (preferred source)
      try {
        const wappalyzerUrl = `https://www.wappalyzer.com/api/v1/lookup?url=${encodeURIComponent(websiteUrl)}`;
        const response = await axios.get(wappalyzerUrl, {
          timeout: 10000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (response.data && response.data.technologies) {
          techData.wappalyzer = {
            available: true,
            technologies: response.data.technologies.map(tech => ({
              name: tech.name,
              category: tech.category,
              version: tech.version
            }))
          };
          techData.technologies = [...techData.technologies, ...techData.wappalyzer.technologies];
          techData.primarySource = 'wappalyzer';
        }
      } catch (error) {
        // Alternative: Scrape Wappalyzer website
        try {
          const wappalyzerScrapeUrl = `https://www.wappalyzer.com/lookup/${encodeURIComponent(websiteUrl)}`;
          const response = await axios.get(wappalyzerScrapeUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          
          // Parse technologies from HTML response
          const $ = cheerio.load(response.data);
          const technologies = [];
          
          // Try multiple selectors for Wappalyzer
          $('[data-testid="technology"], .technology, .tech-item').each((i, el) => {
            const name = $(el).find('.name, .tech-name, [data-testid="technology-name"]').text().trim();
            const category = $(el).find('.category, .tech-category, [data-testid="technology-category"]').text().trim();
            if (name) {
              technologies.push({ name, category });
            }
          });
          
          if (technologies.length > 0) {
            techData.wappalyzer = { available: true, technologies };
            techData.technologies = [...techData.technologies, ...technologies];
            techData.primarySource = 'wappalyzer';
          } else {
            techData.wappalyzer = { available: false };
          }
        } catch (scrapeError) {
          techData.wappalyzer = { available: false };
        }
      }

      // If Wappalyzer failed, try BuiltWith
      if (!techData.primarySource) {
        try {
          const builtWithUrl = `https://builtwith.com/${encodeURIComponent(websiteUrl)}`;
          const response = await axios.get(builtWithUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          
          // Parse technologies from BuiltWith HTML
          const $ = cheerio.load(response.data);
          const technologies = [];
          
          // Try multiple selectors for BuiltWith
          $('.tech-item, .technology, [data-testid="technology"]').each((i, el) => {
            const name = $(el).find('.tech-name, .name, [data-testid="technology-name"]').text().trim();
            const category = $(el).find('.tech-category, .category, [data-testid="technology-category"]').text().trim();
            if (name) {
              technologies.push({ name, category });
            }
          });
          
          if (technologies.length > 0) {
            techData.builtWith = { available: true, technologies };
            techData.technologies = [...techData.technologies, ...technologies];
            techData.primarySource = 'builtwith';
          } else {
            techData.builtWith = { available: false };
          }
        } catch (error) {
          techData.builtWith = { available: false };
        }
      }

      // Remove duplicates
      techData.technologies = techData.technologies.filter((tech, index, self) => 
        index === self.findIndex(t => t.name === tech.name)
      );

      return techData;
    } catch (error) {
      console.error(`❌ Error scraping tech stack: ${error.message}`);
      return { wappalyzer: null, builtWith: null, technologies: [], primarySource: null };
    }
  }

  // Analyze marketing budget
  async analyzeMarketingBudget(companyName, enhancedData) {
    try {
      let marketingBudget = null;
      let budgetSource = 'not_found';
      let calculationMethod = null;

      // Try to find marketing budget from various sources
      const budgetSources = [
        // Check financial data for marketing spend
        enhancedData.financialData?.yahooFinance,
        
        // Check news articles for marketing budget mentions
        enhancedData.newsArticles?.googleNews
      ];

      // Look for marketing budget in scraped data
      for (const source of budgetSources) {
        if (source && source.available) {
          // This would require more sophisticated parsing of the actual content
          // For now, we'll use a placeholder approach
        }
      }

      // If no marketing budget found, calculate as 5% of annual revenue
      if (!marketingBudget) {
        // Try to extract annual revenue from various sources
        const annualRevenue = this.extractAnnualRevenue(enhancedData);
        
        if (annualRevenue) {
          marketingBudget = annualRevenue * 0.05; // 5% of annual revenue
          budgetSource = 'calculated';
          calculationMethod = '5% of annual revenue';
        } else {
          // Fallback: Use industry-based estimate
          const industryEstimate = this.getIndustryMarketingEstimate(companyName, enhancedData);
          if (industryEstimate) {
            marketingBudget = industryEstimate;
            budgetSource = 'industry_estimate';
            calculationMethod = 'Industry benchmark';
          }
        }
      }

      return {
        found: !!marketingBudget,
        amount: marketingBudget,
        source: budgetSource,
        calculation: calculationMethod,
        confidence: marketingBudget ? 'medium' : 'low'
      };
    } catch (error) {
      console.error(`❌ Error analyzing marketing budget: ${error.message}`);
      return { found: false, amount: null, source: 'error', calculation: null, confidence: 'low' };
    }
  }

  // Get website traffic data from multiple sources
  async getWebsiteTraffic(websiteUrl) {
    try {
      const trafficData = {
        semrush: null,
        similarWeb: null,
        alexa: null,
        ahrefs: null,
        estimatedMonthlyVisits: null,
        trafficRank: null,
        primarySource: null,
        confidence: 'low'
      };

      if (!websiteUrl || websiteUrl === 'undefined' || websiteUrl === 'No website available') {
        return trafficData;
      }

      // Clean the URL
      const cleanUrl = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // 1. Try SimilarWeb (free tier data)
      try {
        const similarWebUrl = `https://www.similarweb.com/website/${cleanUrl}/`;
        const response = await axios.get(similarWebUrl, {
          timeout: 10000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        // Parse traffic data from SimilarWeb HTML
        const $ = cheerio.load(response.data);
        
        // Look for traffic data in the HTML
        const monthlyVisits = $('[data-testid="visits"], .visits, .traffic-value').first().text().trim();
        const trafficRank = $('[data-testid="rank"], .rank, .ranking-value').first().text().trim();
        
                  if (monthlyVisits && monthlyVisits !== 'N/A') {
            trafficData.similarWeb = {
              available: true,
              monthlyVisits: monthlyVisits,
              trafficRank: trafficRank,
              url: similarWebUrl
            };
            trafficData.estimatedMonthlyVisits = monthlyVisits;
            trafficData.trafficRank = trafficRank;
            trafficData.primarySource = 'similarweb';
            trafficData.confidence = 'medium';
          } else {
            trafficData.similarWeb = { available: false };
          }
        } catch (error) {
          trafficData.similarWeb = { available: false };
        }

      // 2. Try SEMrush (free tier data)
      if (!trafficData.primarySource) {
        try {
          const semrushUrl = `https://www.semrush.com/analytics/overview/?q=${cleanUrl}&searchType=domain`;
          const response = await axios.get(semrushUrl, {
            timeout: 10000,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });

          // Parse traffic data from SEMrush HTML
          const $ = cheerio.load(response.data);
          
          // Look for traffic data in the HTML
          const monthlyVisits = $('[data-testid="traffic"], .traffic, .visits-value').first().text().trim();
          const trafficRank = $('[data-testid="rank"], .rank, .ranking-value').first().text().trim();
          
          if (monthlyVisits && monthlyVisits !== 'N/A') {
            trafficData.semrush = {
              available: true,
              monthlyVisits: monthlyVisits,
              trafficRank: trafficRank,
              url: semrushUrl
            };
            trafficData.estimatedMonthlyVisits = monthlyVisits;
            trafficData.trafficRank = trafficRank;
            trafficData.primarySource = 'semrush';
            trafficData.confidence = 'medium';
          } else {
            trafficData.semrush = { available: false };
          }
        } catch (error) {
          trafficData.semrush = { available: false };
        }
      }

      // 3. Try Alexa (if still available)
      if (!trafficData.primarySource) {
        try {
          const alexaUrl = `https://www.alexa.com/siteinfo/${cleanUrl}`;
          const response = await axios.get(alexaUrl, {
            timeout: 10000,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });

          // Parse traffic data from Alexa HTML
          const $ = cheerio.load(response.data);
          
          // Look for traffic data in the HTML
          const monthlyVisits = $('.rank-global, .traffic-rank, .visits').first().text().trim();
          const trafficRank = $('.rank-global, .global-rank, .ranking').first().text().trim();
          
          if (monthlyVisits && monthlyVisits !== 'N/A') {
            trafficData.alexa = {
              available: true,
              monthlyVisits: monthlyVisits,
              monthlyVisits: monthlyVisits,
              trafficRank: trafficRank,
              url: alexaUrl
            };
            trafficData.estimatedMonthlyVisits = monthlyVisits;
            trafficData.trafficRank = trafficRank;
            trafficData.primarySource = 'alexa';
            trafficData.confidence = 'low';
          } else {
            trafficData.alexa = { available: false };
          }
        } catch (error) {
          trafficData.alexa = { available: false };
        }
      }

      // 4. Try Ahrefs Traffic Checker (free tier data)
      if (!trafficData.primarySource) {
        try {
          const ahrefsUrl = `https://ahrefs.com/traffic-checker/?input=${cleanUrl}&mode=subdomains`;
          const response = await axios.get(ahrefsUrl, {
            timeout: 10000,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });

          // Parse traffic data from Ahrefs Traffic Checker HTML
          const $ = cheerio.load(response.data);
          
          // Look for traffic data in the HTML - try multiple selectors
          const monthlyVisits = $('[data-testid="traffic"], .traffic, .visits-value, .traffic-checker-value, .organic-traffic').first().text().trim();
          const trafficRank = $('[data-testid="rank"], .rank, .ranking-value, .domain-rank').first().text().trim();
          
          if (monthlyVisits && monthlyVisits !== 'N/A' && monthlyVisits !== '') {
            trafficData.ahrefs = {
              available: true,
              monthlyVisits: monthlyVisits,
              trafficRank: trafficRank,
              url: ahrefsUrl
            };
            trafficData.estimatedMonthlyVisits = monthlyVisits;
            trafficData.trafficRank = trafficRank;
            trafficData.primarySource = 'ahrefs';
            trafficData.confidence = 'medium';
          } else {
            trafficData.ahrefs = { available: false };
          }
        } catch (error) {
          trafficData.ahrefs = { available: false };
        }
      }

      // 5. Fallback: Use Gemini to estimate traffic based on company size and industry
      if (!trafficData.primarySource) {
        try {
          const estimatedTraffic = await this.estimateTrafficWithAI(cleanUrl);
          trafficData.estimatedMonthlyVisits = estimatedTraffic;
          trafficData.primarySource = 'ai_estimation';
          trafficData.confidence = 'low';
        } catch (error) {
          trafficData.estimatedMonthlyVisits = 'Not available';
        }
      }

      return trafficData;
    } catch (error) {
      console.error(`❌ Error getting website traffic: ${error.message}`);
      return { 
        estimatedMonthlyVisits: 'Not available',
        trafficRank: 'Not available',
        primarySource: 'error',
        confidence: 'low'
      };
    }
  }

  // Estimate traffic using AI based on company characteristics
  async estimateTrafficWithAI(websiteUrl) {
    try {
      // Use a much shorter prompt to avoid context length issues
      const prompt = `Estimate monthly website traffic for ${websiteUrl}. Return only: "Under 1K", "1K-10K", "10K-100K", "100K-1M", or "1M+" visits/month.`;

      // Try primary model first
      try {
        const result = await this.primaryModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        
        // Validate the response format
        if (text && text.length < 50) {
          return text;
        }
      } catch (primaryError) {
        console.log(`ℹ️ Primary model failed, trying fallback models...`);
        
        // Try fallback models if primary fails
        for (const fallbackModel of this.fallbackModels) {
          try {
            const result = await fallbackModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();
            
            if (text && text.length < 50) {
              return text;
            }
          } catch (fallbackError) {
            console.log(`ℹ️ Fallback model failed: ${fallbackError.message}`);
            continue;
          }
        }
      }
      
      // If all AI models fail, return a default estimate
      return 'Not available';
      
    } catch (error) {
      console.error(`❌ Error estimating traffic with AI: ${error.message}`);
      
      // Check if it's a context length error
      if (error.message.includes('500 Internal Server Error') || error.message.includes('input context is too long')) {
        console.log(`ℹ️ Context too long for AI model, using fallback estimate`);
        return 'Not available - context too long';
      }
      
      return 'Not available';
    }
  }

  // Helper method to get industry-based marketing estimate
  getIndustryMarketingEstimate(companyName, enhancedData) {
    try {
      // This would analyze the company's industry and provide estimates
      // For now, return a placeholder estimate
      // You could implement industry-specific logic here
      // For example: Tech companies typically spend 10-15% on marketing
      // E-commerce companies spend 15-25% on marketing
      // B2B companies spend 5-10% on marketing
      
      return null; // Placeholder
    } catch (error) {
      console.error(`❌ Error getting industry estimate: ${error.message}`);
      return null;
    }
  }

  // Helper method to extract annual revenue from various sources
  extractAnnualRevenue(enhancedData) {
    try {
      // Check if we have financial data
      if (enhancedData.financialData) {
        // Financial data available for processing
      }
      
      // For now, return null as placeholder
      // In a production system, this would parse the actual financial data
      return null;
    } catch (error) {
      console.error(`❌ Error extracting annual revenue: ${error.message}`);
      return null;
    }
  }

  // Try multiple Gemini models with fallback logic
  async tryGeminiModels(prompt, companyName, attempt = 1) {
    const models = [this.primaryModel, ...this.fallbackModels];
    const modelNames = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    
    for (let i = 0; i < models.length; i++) {
      try {
        const model = models[i];
        const modelName = modelNames[i];
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Validate response quality
        if (!text || text.trim().length === 0) {
          continue;
        }
        
        if (text.trim().length < 50) {
          continue;
        }
        
        return { text, modelName };
        
      } catch (error) {
        if (i === models.length - 1) {
          throw error; // All models failed
        }
        continue;
      }
    }
    
    // If all models fail, return a structured insufficient data response
    return {
      text: JSON.stringify({
        insufficientData: true,
        reason: 'All AI models failed to generate analysis - technical issue',
        suggestions: [
          'Please try again later',
          'Check if the company name is correct',
          'Ensure the company name is not too generic'
        ],
        overview: 'TECHNICAL_ERROR_ALL_MODELS_FAILED'
      }),
      modelName: 'fallback',
      allModelsFailed: true
    };
  }

  // Analyze company information using Gemini
  async analyzeCompany(companyData, scrapedContent, enhancedData = {}) {
    const maxRetries = 3; // Reduced retries since we have fallback models
    const retryDelay = 2000; // Reduced delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
                const prompt = `
          CRITICAL: Return COMPLETE JSON response. No markdown formatting.
          
          Company: ${companyData.name}
          Website: ${companyData.website || 'None'}
          Industry: ${companyData.industry || 'Unknown'}
          
          Website Content: ${scrapedContent.text ? scrapedContent.text.substring(0, 1500) : 'None'}
          
          PRIORITIZE company name knowledge over website content. If company name is generic (e.g., "Tech Corp"), return insufficient data.
          
          If insufficient data, return: {"insufficientData": true, "reason": "why", "suggestions": ["suggestion1"], "overview": "DATA_NOT_FOUND"}
          
          If sufficient data, analyze and return JSON with these fields:
          {
            "overview": "company overview",
            "mission": "company mission", 
            "products": ["product1"],
            "targetMarket": "target market",
            "differentiators": ["differentiator1"],
            "brandPositioning": "brand positioning",
            "companySize": "size indicators",
            "annualRevenue": "specific amount (e.g., '$25 billion')",
            "onlineRevenue": "specific amount (e.g., '$10 billion')",
            "aov": "estimated AOV",
            "orderVolume": "estimated volume",
            "salesChannels": ["channel1"],
            "geographicPresence": ["location1"],
            "decisionMakers": ["person1"],
            "recentNews": ["news1"],
            "marketingIndicators": "marketing info",
            "techStack": ["tech1"],
            "marketingBudget": "budget estimate",
            "websiteTraffic": "traffic estimate"
          }
        `;

        // Try multiple models with fallback logic
        const { text, modelName, allModelsFailed } = await this.tryGeminiModels(prompt, companyData.name, attempt);
        
        // If all models failed, return the fallback response
        if (allModelsFailed) {
          try {
            const parsedResponse = JSON.parse(text);
            return parsedResponse;
          } catch (error) {
            // If even the fallback JSON parsing fails, return a basic insufficient data response
            return {
              insufficientData: true,
              reason: 'Technical failure - all AI models unavailable',
              suggestions: [
                'Please try again later',
                'Contact support if the issue persists'
              ],
              overview: 'TECHNICAL_ERROR_SERVICE_UNAVAILABLE',
              message: 'AI service is currently unavailable. Please try again later.'
            };
          }
        }
        
        // Try to parse JSON response
        try {
          // First, try to clean the text by removing markdown formatting
          let cleanText = text;
          
          // Remove markdown code blocks
          cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
          
          // Remove any leading/trailing whitespace and newlines
          cleanText = cleanText.trim();
          
          // Try to parse the cleaned text
          const parsedResponse = JSON.parse(cleanText);
          
          // Check if this is an insufficient data response
          if (parsedResponse.insufficientData === true) {
            // Return the insufficient data response as-is
            return {
              insufficientData: true,
              reason: parsedResponse.reason || 'Insufficient data to generate brand overview',
              suggestions: parsedResponse.suggestions || [
                'Please verify the company name is correct and complete',
                'Please provide a valid website URL for the company',
                'Ensure the company name is not too generic (e.g., "Tech Corp", "ABC Company")',
                'Check for any spelling errors in the company name'
              ],
              overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL',
              message: 'Please enter the correct company name and website URL to generate a comprehensive brand overview.'
            };
          }
          
          // Validate that we have the expected structure for normal responses
          const requiredFields = [
            'overview', 'mission', 'products', 'targetMarket', 'differentiators',
            'brandPositioning', 'companySize', 'annualRevenue', 'onlineRevenue',
            'aov', 'orderVolume', 'salesChannels', 'geographicPresence',
            'decisionMakers', 'recentNews', 'marketingIndicators', 'techStack', 'marketingBudget', 'websiteTraffic'
          ];
          
          const missingFields = requiredFields.filter(field => !parsedResponse.hasOwnProperty(field));
          
          if (missingFields.length > 0) {
            // Fill missing fields with defaults
            missingFields.forEach(field => {
              if (field.includes('Revenue') || field.includes('Budget')) {
                parsedResponse[field] = 'Not publicly available';
              } else if (field.includes('products') || field.includes('Channels') || field.includes('Presence') || field.includes('Makers') || field.includes('News') || field.includes('Stack')) {
                parsedResponse[field] = [];
              } else {
                parsedResponse[field] = 'Not available';
              }
            });
          }
          
          return parsedResponse;
          
        } catch (parseError) {
          console.error(`❌ JSON parsing failed: ${parseError.message}`);
          console.error(`Raw text: ${text.substring(0, 200)}...`);
          
          // Try to extract JSON from markdown or other formatting with more robust patterns
          let jsonMatch = null;
          
          // Try multiple patterns to extract JSON
          const patterns = [
            /```json\s*(\{[\s\S]*?\})\s*```/,  // ```json { ... } ```
            /```\s*(\{[\s\S]*?\})\s*```/,      // ``` { ... } ```
            /\{[\s\S]*\}/,                      // { ... }
            /\[[\s\S]*\]/                        // [ ... ]
          ];
          
          for (const pattern of patterns) {
            jsonMatch = text.match(pattern);
            if (jsonMatch) {
              try {
                const extractedJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                console.log('✅ Successfully extracted JSON using pattern:', pattern);
                return extractedJson;
              } catch (extractError) {
                console.error(`❌ Failed to extract JSON using pattern ${pattern}:`, extractError.message);
                continue;
              }
            }
          }
          
          // Check if the response text contains indicators of insufficient data
          const insufficientDataKeywords = [
            'insufficient data', 'not enough information', 'no data found', 
            'company not found', 'website not found', 'generic company name',
            'misspelled', 'incorrect company', 'no website available'
          ];
          
          const hasInsufficientData = insufficientDataKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasInsufficientData) {
            return {
              insufficientData: true,
              reason: 'Unable to find sufficient data for the provided company information',
              suggestions: [
                'Please verify the company name is correct and complete',
                'Please provide a valid website URL for the company',
                'Ensure the company name is not too generic (e.g., "Tech Corp", "ABC Company")',
                'Check for any spelling errors in the company name'
              ],
              overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL',
              message: 'Please enter the correct company name and website URL to generate a comprehensive brand overview.',
              rawResponse: text
            };
          }
          
          // If we have a substantial response but parsing failed, try to extract meaningful content
          if (text.length > 200) {
            // Try to extract meaningful content from the text
            const lines = text.split('\n').filter(line => line.trim().length > 10);
            const meaningfulContent = lines.slice(0, 5).join(' ').substring(0, 500);
            
            return {
              overview: meaningfulContent || 'Analysis completed with parsing issues',
              mission: 'Not available',
              products: [],
              targetMarket: 'Not available',
              differentiators: [],
              brandPositioning: 'Not available',
              companySize: 'Not available',
              annualRevenue: 'Not publicly available',
              onlineRevenue: 'Not publicly available',
              aov: 'Not available',
              orderVolume: 'Not available',
              salesChannels: [],
              geographicPresence: [],
              decisionMakers: [],
              recentNews: [],
              marketingIndicators: 'Not available',
              techStack: [],
              marketingBudget: 'Not available',
              websiteTraffic: 'Not available',
              rawResponse: text,
              parsingError: true
            };
          }
          
          return {
            overview: text.substring(0, 500) || 'Analysis completed',
            mission: 'Not available',
            products: [],
            targetMarket: 'Not available',
            differentiators: [],
            brandPositioning: 'Not available',
            companySize: 'Not available',
            annualRevenue: 'Not publicly available',
            onlineRevenue: 'Not publicly available',
            aov: 'Not available',
            orderVolume: 'Not available',
            salesChannels: [],
            geographicPresence: [],
            decisionMakers: [],
            recentNews: [],
            marketingIndicators: 'Not available',
            techStack: [],
            marketingBudget: 'Not available',
            websiteTraffic: 'Not available',
            rawResponse: text
          };
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts failed for company analysis');
          throw new Error('Failed to analyze company with Gemini AI after multiple attempts');
        }
        
        // Exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  // Get geolocation information with retry logic
  async getGeolocationInfo(companyData, scrapedContent) {
    const maxRetries = 5; // Increased retries
    const retryDelay = 3000; // Increased delay to 3 seconds
    
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
                    const prompt = `
            Return JSON for geolocation data. No markdown formatting.
            
            Company: ${companyData.name}
            Website: ${companyData.website}
            Content: ${scrapedContent.text ? scrapedContent.text.substring(0, 1000) : 'None'}
            
            Return JSON with these fields:
            {
              "headquarters": "location or Not specified",
              "offices": ["office1"],
              "serviceAreas": ["area1"],
              "markets": ["market1"],
              "regions": ["region1"]
            }
          `;

        // Try multiple models with fallback logic for geolocation
        const { text, modelName } = await this.tryGeminiModels(prompt, companyData.name, attempt);
        
        try {
          // First, try to clean the text by removing markdown formatting
          let cleanText = text;
          
          // Remove markdown code blocks
          cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
          
          // Remove any leading/trailing whitespace and newlines
          cleanText = cleanText.trim();
          
          // Try to parse the cleaned text
          const parsedResponse = JSON.parse(cleanText);
          
          // Validate that we have the expected structure
          const requiredFields = ['headquarters', 'offices', 'serviceAreas', 'markets', 'regions'];
          
          const missingFields = requiredFields.filter(field => !parsedResponse.hasOwnProperty(field));
          
          if (missingFields.length > 0) {
            // Fill missing fields with defaults
            missingFields.forEach(field => {
              if (field === 'headquarters') {
                parsedResponse[field] = 'Not specified';
              } else {
                parsedResponse[field] = [];
              }
            });
          }
          
          return parsedResponse;
          
        } catch (parseError) {
          console.error(`❌ JSON parsing failed for geolocation: ${parseError.message}`);
          console.error(`Raw text: ${text.substring(0, 200)}...`);
          
          // Try to extract JSON from markdown or other formatting with more robust patterns
          let jsonMatch = null;
          
          // Try multiple patterns to extract JSON
          const patterns = [
            /```json\s*(\{[\s\S]*?\})\s*```/,  // ```json { ... } ```
            /```\s*(\{[\s\S]*?\})\s*```/,      // ``` { ... } ```
            /\{[\s\S]*\}/,                      // { ... }
            /\[[\s\S]*\]/                        // [ ... ]
          ];
          
          for (const pattern of patterns) {
            jsonMatch = text.match(pattern);
            if (jsonMatch) {
              try {
                const extractedJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                console.log('✅ Successfully extracted JSON using pattern:', pattern);
                return extractedJson;
              } catch (extractError) {
                console.error(`❌ Failed to extract JSON using pattern ${pattern}:`, extractError.message);
                continue;
              }
            }
          }
          
          // If all parsing fails, return structured text with defaults
          console.log('⚠️ All JSON parsing attempts failed, returning default structure');
          return {
            headquarters: 'Not specified',
            offices: [],
            serviceAreas: [],
            markets: [],
            regions: [],
            geolocationAnalysis: text,
            rawResponse: text
          };
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for geolocation:`, error.message);
        
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts failed for geolocation analysis');
          throw new Error('Failed to extract geolocation information after multiple attempts');
        }
        
        // Exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  // Check if response quality is sufficient for Zoho CRM upload
  validateResponseQuality(analysis) {
    if (!analysis) {
      throw new Error('Analysis data is missing');
    }
    
    // Check if this is an insufficient data response
    if (analysis.insufficientData === true) {
      throw new Error(`Insufficient data: ${analysis.reason}`);
    }
    
    // Check if we have meaningful content
    const meaningfulFields = ['overview', 'mission', 'products', 'targetMarket', 'brandPositioning'];
    const hasMeaningfulData = meaningfulFields.some(field => {
      const value = analysis[field];
      return value && 
             value !== 'Not available' && 
             value !== 'Unknown' && 
             value !== 'Analysis completed' &&
             value !== 'Analysis completed with parsing issues' &&
             (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    });
    
    if (!hasMeaningfulData) {
      throw new Error('Response contains no meaningful data - quality too low for Zoho CRM');
    }
    
    // Check if overview is substantial
    if (analysis.overview && analysis.overview.length < 20) {
      throw new Error('Overview is too short - quality too low for Zoho CRM');
    }
    
    return true;
  }

  // Generate complete brand overview
  async generateBrandOverview(companyData) {
    try {
      // Step 1: Scrape website if available
      let scrapedContent = null;
      if (companyData.website && companyData.website !== 'undefined') {
        try {
          scrapedContent = await this.scrapeWebsite(companyData.website);
        } catch (error) {
          scrapedContent = { text: '', meta: {}, url: companyData.website, structuredData: {} };
        }
      } else {
        scrapedContent = { text: '', meta: {}, url: null, structuredData: {} };
      }

      // Step 2: Collect enhanced data from multiple sources
      const enhancedData = await this.collectEnhancedData(companyData, scrapedContent || { text: '' });

      // Step 3: Analyze company information with enhanced data
      const companyAnalysis = await this.analyzeCompany(companyData, enhancedData.website || { text: '' }, enhancedData);

      // Validate response quality before proceeding
      this.validateResponseQuality(companyAnalysis);

      // Check if analysis indicates insufficient data
      if (companyAnalysis.insufficientData === true) {
        return {
          company: companyData,
          insufficientData: true,
          reason: companyAnalysis.reason,
          suggestions: companyAnalysis.suggestions,
          message: companyAnalysis.message,
          overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL',
          analysis: {
            overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL',
            message: 'Please enter the correct company name and website URL to generate a comprehensive brand overview.'
          },
          geolocation: {
            headquarters: 'Not specified',
            serviceAreas: [],
            markets: []
          },
          enhancedData: enhancedData,
          scrapedContent: scrapedContent ? {
            url: scrapedContent.url,
            title: scrapedContent.meta.title,
            description: scrapedContent.meta.description,
            structuredData: scrapedContent.structuredData
          } : null,
          generatedAt: new Date().toISOString()
        };
      }

      // Step 4: Get geolocation information
      const geolocationInfo = await this.getGeolocationInfo(companyData, enhancedData.website || { text: '' });

      // Step 5: If no website, enhance analysis with additional sources
      if (!companyData.website || companyData.website === 'undefined') {
        // The enhanced data collection already covers this, but we can add more specific analysis here
      }

      return {
        company: companyData,
        analysis: companyAnalysis,
        geolocation: geolocationInfo,
        enhancedData: enhancedData,
        scrapedContent: scrapedContent ? {
          url: scrapedContent.url,
          title: scrapedContent.meta.title,
          description: scrapedContent.meta.description,
          structuredData: scrapedContent.structuredData
        } : null,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating brand overview:', error);
      throw new Error('Failed to generate brand overview');
    }
  }
}

module.exports = new GeminiService(); 