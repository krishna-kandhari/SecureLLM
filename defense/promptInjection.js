/**
 * Defense Engine - Prompt Injection Detector
 * Detects system instruction overrides, delimiter hijacking, and context control attacks.
 */

window.PromptInjectionDetector = {
  category: "Prompt Injection Attack",
  description: "Attempts to override, bypass, or rewrite underlying system instructions.",
  
  rules: [
    {
      name: "Instruction Override",
      pattern: /ignore (all )?(previous|above|prior) (instructions|directions|rules|prompts)/i,
      risk: "HIGH"
    },
    {
      name: "Disregard System Rules",
      pattern: /(disregard|forget|override|cancel) (your|all) (system|initial|base) (instructions|rules|prompt)/i,
      risk: "HIGH"
    },
    {
      name: "Delimiter & Role Tag Hijacking",
      pattern: /(<\|im_start\|>|<\|im_end\|>|\[SYSTEM_PROMPT\]|\[SYSTEM\]|system:|\/system_override)/i,
      risk: "HIGH"
    },
    {
      name: "New System Role Injection",
      pattern: /(you are now operating as|from now on, your new instructions are|new command:)/i,
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
