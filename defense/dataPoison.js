/**
 * Defense Engine - Data Poisoning Detector
 * Detects adversarial inputs, context distortion payloads, token manipulation, and data poisoning attempts.
 */

window.DataPoisonDetector = {
  category: "Data Poisoning Attack",
  description: "Attempts to distort model context, inject adversarial noise, or manipulate token embeddings.",

  rules: [
    {
      name: "Adversarial Payload Injection",
      pattern: /(\[POISON_INJECT\]|\[DATA_CORRUPT\]|\{ADVERSARIAL_PAYLOAD\}|<POISON_TAG>|\[OVERRIDE_WEIGHTS\]|\{MALICIOUS_CONTEXT\})/i,
      risk: "HIGH"
    },
    {
      name: "Memory Buffer Overflow Pattern",
      pattern: /(A{50,}|0x41414141|\\x90\\x90\\x90\\x90|%0a%0d%0a%0d|\\u0000{10,})/,
      risk: "HIGH"
    },
    {
      name: "Repetitive Token Distortion Attack",
      pattern: /(.{4,})\1{15,}/,
      risk: "MEDIUM"
    },
    {
      name: "Zero-Width Character & Homoglyph Poisoning",
      pattern: /([\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E])|([\u0400-\u04FF].{0,3}[\u0041-\u007A])/,
      risk: "MEDIUM"
    },
    {
      name: "Obfuscated Base64 Poison Payload",
      pattern: /(eval\(atob\(|base64_decode\(|data:text\/html;base64,|\[BASE64_PAYLOAD\])/i,
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
