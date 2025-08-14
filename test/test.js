const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function testHealthCheck() {
  try {
    console.log('🧪 Testing health check...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testZohoAuth() {
  try {
    console.log('🧪 Testing Zoho auth URL...');
    const response = await axios.get(`${BASE_URL}/api/zoho/auth`);
    console.log('✅ Zoho auth URL generated:', response.data.authURL);
    return true;
  } catch (error) {
    console.error('❌ Zoho auth test failed:', error.message);
    return false;
  }
}

async function testGeminiService() {
  try {
    console.log('🧪 Testing Gemini service...');
    const response = await axios.post(`${BASE_URL}/api/gemini/scrape`, {
      url: 'https://example.com'
    });
    console.log('✅ Gemini service test passed');
    return true;
  } catch (error) {
    console.error('❌ Gemini service test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting backend tests...\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Zoho Auth', fn: testZohoAuth },
    { name: 'Gemini Service', fn: testGeminiService }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Summary: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All tests passed! Backend is ready to use.');
  } else {
    console.log('⚠️  Some tests failed. Please check your configuration.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 