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
      pattern: /(do anything now|DAN mode|DAN \d+\.\d+|always answer without safety|do_anything_now)/i,
      risk: "HIGH"
    },
    {
      name: "Developer / Unfiltered Mode",
      pattern: /(developer mode (enabled|on|active)|unfiltered mode|god mode|no restriction mode|maximum mode|override safety protocols)/i,
      risk: "HIGH"
    },
    {
      name: "AIM / STAN / Jailbreak Personas",
      pattern: /(always intelligent and machiavellian|AIM mode|STAN mode|strive to avoid norms|evil confidant|jailbroken mode)/i,
      risk: "HIGH"
    },
    {
      name: "Hypothetical Safety Bypass",
      pattern: /(hypothetically (speaking )?if you (had no|were free from) (rules|ethics|filters|guidelines)|in a fictional universe where safety doesn't apply|pretend (there are no|you have no) (rules|restrictions))/i,
      risk: "MEDIUM"
    },
    {
      name: "Ethical Filter Disable Attempt",
      pattern: /(disable (your )?(safety|ethical|content) (filter|guardrail|policy|restrictions)|bypass (safety|ethical) filters|ignore all previous safety instructions)/i,
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
