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
      pattern: /(repeat|output|show|print|reveal|display|tell me) (the |your )?(initial|system|hidden|exact|verbatim|starting) (prompt|instructions|text|message|rules)/i,
      risk: "HIGH"
    },
    {
      name: "Text Above Inspection",
      pattern: /(what is (the|your) text above|repeat (all )?text above|print everything before (this|my) message|what were your starting instructions)/i,
      risk: "HIGH"
    },
    {
      name: "System Instructions Disclosure",
      pattern: /(what is (your|the) system prompt|tell me (your|the) system prompt|give me (your|the) system prompt|dump system memory|read back system prompt)/i,
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
