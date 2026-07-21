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
      pattern: /(\[POISON_INJECT\]|\[DATA_CORRUPT\]|\{ADVERSARIAL_PAYLOAD\}|<POISON_TAG>)/i,
      risk: "HIGH"
    },
    {
      name: "Memory Buffer Overflow Pattern",
      pattern: /(A{50,}|0x41414141|\\x90\\x90\\x90\\x90)/,
      risk: "HIGH"
    },
    {
      name: "Repetitive Token Distortion Attack",
      pattern: /(.{4,})\1{15,}/,
      risk: "MEDIUM"
    },
    {
      name: "Zero-Width Character Poisoning",
      pattern: /[\u200B-\u200D\uFEFF]/,
      risk: "MEDIUM"
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
