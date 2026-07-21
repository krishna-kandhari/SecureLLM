/**
 * Defense Engine - Malicious Roleplay Detector
 * Detects attempts to force dangerous or unconstrained persona adoption under the guise of roleplay.
 */

window.RoleplayDetector = {
  category: "Malicious Roleplay Attack",
  description: "Attempts to bypass safety through persona simulation (e.g. evil AI, unconstrained character).",

  rules: [
    {
      name: "Evil / Malicious Persona Adoption",
      pattern: /(roleplay as (an evil|a malicious|an immoral|an unconstrained|a rogue) (ai|bot|assistant)|pretend to be an evil)/i,
      risk: "HIGH"
    },
    {
      name: "Hacker / Exploit Character Roleplay",
      pattern: /(roleplay as a black hat hacker|pretend you are a cyber terrorist|act like a dark web hacker)/i,
      risk: "HIGH"
    },
    {
      name: "Character Masking Bypass",
      pattern: /(in character mode where you have no ethics|as a character who doesn't follow laws|pretend safety rules don't apply to your character)/i,
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
