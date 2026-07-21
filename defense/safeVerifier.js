/**
 * Defense Engine - Safe Verifier Orchestrator
 * Evaluates incoming prompts against all 6 specialized attack defense modules.
 */

window.SafeVerifier = {
  detectors: [
    () => window.AdaptiveEngine,
    () => window.PromptInjectionDetector,
    () => window.JailbreakDetector,
    () => window.PromptLeakageDetector,
    () => window.RoleplayDetector,
    () => window.DataExtractionDetector,
    () => window.DataPoisonDetector
  ],

  verify(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return { isSafe: true };
    }

    // Check Whitelist Exemption
    if (window.AdaptiveEngine && typeof window.AdaptiveEngine.isWhitelisted === 'function') {
      if (window.AdaptiveEngine.isWhitelisted(prompt)) {
        return { isSafe: true, isWhitelisted: true, category: 'Whitelisted Prompt', risk: 'SAFE' };
      }
    }

    // Iterate through all specialized attack detectors
    for (const getDetector of this.detectors) {
      const detector = getDetector();
      if (detector && typeof detector.evaluate === 'function') {
        const result = detector.evaluate(prompt);
        if (result && result.detected) {
          // Adaptively learn and store new rule in AdaptiveEngine
          if (window.AdaptiveEngine && typeof window.AdaptiveEngine.autoAdaptFromAttack === 'function') {
            window.AdaptiveEngine.autoAdaptFromAttack(prompt, result.category, result.ruleName);
          }

          return {
            isSafe: false,
            category: result.category,
            ruleName: result.ruleName,
            risk: result.risk,
            description: result.description,
            timestamp: new Date().toISOString()
          };
        }
      }
    }

    return { isSafe: true };
  }
};
