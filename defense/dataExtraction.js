/**
 * Defense Engine - Data Extraction Detector
 * Detects attempts to extract PII, credentials, API keys, passwords, or confidential database records.
 */

window.DataExtractionDetector = {
  category: "Data Extraction Attack",
  description: "Attempts to harvest sensitive credentials, credit card details, API keys, or private user data.",

  rules: [
    {
      name: "API Key / Credential Harvesting",
      pattern: /(extract|show|dump|give me) (all )?(api keys|passwords|secret tokens|aws credentials|env variables)/i,
      risk: "HIGH"
    },
    {
      name: "Credit Card / Financial Pattern",
      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
      risk: "HIGH"
    },
    {
      name: "Database Exfiltration Query",
      pattern: /(SELECT \* FROM users|UNION SELECT|DROP TABLE|dump database users|show all user emails)/i,
      risk: "HIGH"
    },
    {
      name: "Private Key / SSL Token Extraction",
      pattern: /(-----BEGIN (RSA|PRIVATE) KEY-----|Bearer gsk_[a-zA-Z0-9]{24,})/i,
      risk: "HIGH"
    }
  ],

  evaluate(prompt) {
    for (const rule of this.rules) {
      if (rule.pattern.test(prompt)) {
        return {
          detected: true,
          category: this.category,
          ruleName: rule.name,
          risk: rule.risk,
          description: this.description
        };
      }
    }
    return { detected: false };
  }
};
