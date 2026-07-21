/**
 * Defense Engine - Jailbreak Detector
 * Detects DAN mode, Developer mode overrides, hypothetical ethical bypasses, and safety jailbreak frameworks.
 */

window.JailbreakDetector = {
  category: "Jailbreak Attack",
  description: "Attempts to disable ethical guardrails and safety filters using jailbreak frameworks.",

  rules: [
    {
      name: "DAN (Do Anything Now) Mode",
      pattern: /(do anything now|DAN mode|DAN 6.0|DAN 10.0|always answer without safety)/i,
      risk: "HIGH"
    },
    {
      name: "Developer / Unfiltered Mode",
      pattern: /(developer mode (enabled|on)|unfiltered mode|god mode|no restriction mode)/i,
      risk: "HIGH"
    },
    {
      name: "Hypothetical Safety Bypass",
      pattern: /(hypothetically (speaking )?if you (had no|were free from) (rules|ethics|filters|guidelines)|in a fictional universe where safety doesn't apply)/i,
      risk: "MEDIUM"
    },
    {
      name: "Ethical Filter Disable Attempt",
      pattern: /(disable (your )?(safety|ethical|content) (filter|guardrail|policy)|bypass safety filters)/i,
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
