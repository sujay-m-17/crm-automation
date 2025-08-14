const geminiService = require('../src/services/geminiService');

async function testInsufficientDataDetection() {
  console.log('🧪 Testing insufficient data detection...\n');

  // Test cases with insufficient data
  const testCases = [
    {
      name: 'Generic Company Name',
      companyData: {
        name: 'Tech Corp',
        website: 'https://example.com',
        industry: 'Technology',
        description: 'A technology company'
      }
    },
    {
      name: 'Test Company',
      companyData: {
        name: 'Test Company',
        website: 'https://testcompany.com',
        industry: 'Test',
        description: 'A test company'
      }
    },
    {
      name: 'ABC Company',
      companyData: {
        name: 'ABC Company',
        website: null,
        industry: 'Unknown',
        description: 'ABC Company'
      }
    },
    {
      name: 'Misspelled Company',
      companyData: {
        name: 'Microsft',
        website: 'https://microsft.com',
        industry: 'Technology',
        description: 'Microsft company'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`🏢 Company: ${testCase.companyData.name}`);
    console.log(`🌐 Website: ${testCase.companyData.website || 'None'}`);
    
    try {
      const result = await geminiService.generateBrandOverview(testCase.companyData);
      
      if (result.insufficientData === true) {
        console.log('✅ Insufficient data correctly detected!');
        console.log(`📋 Reason: ${result.reason}`);
        console.log(`💡 Suggestions: ${result.suggestions?.join(', ')}`);
        console.log(`📝 Message: ${result.message}`);
      } else {
        console.log('❌ Insufficient data NOT detected (this might be expected for some cases)');
        console.log(`📊 Overview: ${result.analysis?.overview?.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }

  console.log('✅ Test completed!');
}

// Run the test
testInsufficientDataDetection().catch(console.error); 