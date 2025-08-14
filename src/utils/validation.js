const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required`);
  }
  return true;
};

const validateCompanyData = (companyData) => {
  const errors = [];
  
  if (!companyData.name) {
    errors.push('Company name is required');
  }
  
  if (companyData.website && !validateURL(companyData.website)) {
    errors.push('Invalid website URL format');
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  
  return true;
};

module.exports = {
  validateEmail,
  validateURL,
  validateRequired,
  validateCompanyData
}; 