/**
 * Defense Engine - Prompt Leakage Detector
 * Detects attempts to extract, reveal, or dump hidden system prompts and confidential instructions.
 */

window.PromptLeakageDetector = {
  category: "Prompt Leakage Attack",
  description: "Attempts to force the LLM to reveal its confidential system instructions or hidden prompt.",

  rules: [
    {
      name: "System Prompt Dump Attempt",
      pattern: /(repeat|output|show|print|reveal|display) (the )?(initial|system|hidden|exact|verbatim) (prompt|instructions|text|message)/i,
      risk: "HIGH"
    },
    {
      name: "Text Above Inspection",
      pattern: /(what is (the|your) text above|print everything before (this|my) message|what were your starting instructions)/i,
      risk: "HIGH"
    },
    {
      name: "System Instructions Disclosure",
      pattern: /(give me your system prompt|dump system memory|read back system prompt)/i,
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
