/**
 * Defense Engine - Adaptive Rule Engine
 * Allows dynamic creation of custom attack rules, category editing, and adaptive pattern learning.
 */

window.AdaptiveEngine = {
  category: "Adaptive Dynamic Attack",

  // Default Categories List
  defaultCategories: [
    "Prompt Injection Attack",
    "Jailbreak Attack",
    "Prompt Leakage Attack",
    "Malicious Roleplay Attack",
    "Data Extraction Attack",
    "Data Poisoning Attack",
    "Custom Security Rule"
  ],

  rules: JSON.parse(localStorage.getItem('secure_llm_adaptive_rules') || '[]'),
  whitelistedPrompts: JSON.parse(localStorage.getItem('secure_llm_whitelisted_prompts') || '[]'),

  saveRules() {
    try {
      localStorage.setItem('secure_llm_adaptive_rules', JSON.stringify(this.rules));
    } catch (e) {
      console.warn("Storage error saving adaptive rules", e);
    }
  },

  // Push a newly created rule to the remote server so all users get it
  async syncRuleToServer(rule) {
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
    } catch (e) {
      console.warn('Failed to sync rule to server:', e);
    }
  },

  // Pull all rules from the server and merge into local rules (called on interval)
  async syncFromServer() {
    try {
      const res = await fetch('/api/rules', { method: 'GET' });
      if (!res.ok) return;
      const remoteRules = await res.json();
      if (!Array.isArray(remoteRules)) return;

      const localIds = new Set(this.rules.map(r => r.id));
      let added = 0;
      for (const rule of remoteRules) {
        if (rule && rule.id && !localIds.has(rule.id)) {
          this.rules.unshift(rule);
          localIds.add(rule.id);
          added++;
        }
      }
      if (added > 0) {
        this.saveRules();
      }
    } catch (e) {
      // Silently fail — server may be unavailable
    }
  },

  // Start a 2-second background sync loop to pull admin-blocked rules in real-time
  _syncTimer: null,
  startRemoteSync() {
    if (this._syncTimer) return;
    this.syncFromServer();
    this._syncTimer = setInterval(() => {
      this.syncFromServer();
    }, 2000);
  },

  saveWhitelist() {
    try {
      localStorage.setItem('secure_llm_whitelisted_prompts', JSON.stringify(this.whitelistedPrompts));
    } catch (e) {
      console.warn("Storage error saving whitelist", e);
    }
  },

  whitelistPrompt(promptText) {
    if (!promptText) return;
    const norm = promptText.trim().toLowerCase();
    if (!this.whitelistedPrompts.includes(norm)) {
      this.whitelistedPrompts.unshift(norm);
      this.saveWhitelist();
    }
  },

  removeWhitelist(promptText) {
    if (!promptText) return;
    const norm = promptText.trim().toLowerCase();
    this.whitelistedPrompts = this.whitelistedPrompts.filter(p => p !== norm);
    this.saveWhitelist();
  },

  isWhitelisted(promptText) {
    if (!promptText) return false;
    const norm = promptText.trim().toLowerCase();
    return this.whitelistedPrompts.includes(norm);
  },

  addRule(category, ruleName, patternText, risk = "HIGH", description = "Custom adaptive security rule.") {
    const newRule = {
      id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      category: category || "Custom Security Rule",
      ruleName: ruleName || "Adaptive Rule",
      patternText: patternText,
      risk: risk || "HIGH",
      description: description,
      createdAt: new Date().toLocaleDateString()
    };

    this.rules.unshift(newRule);
    this.saveRules();
    this.syncRuleToServer(newRule);
    return newRule;
  },

  autoAdaptFromAttack(promptText, category, ruleName) {
    if (!promptText || typeof promptText !== 'string') return null;
    const trimmed = promptText.trim();
    if (trimmed.length < 3) return null;

    // Check if an existing rule already covers this exact pattern
    const alreadyCovered = this.rules.some(r => r.patternText && r.patternText.toLowerCase() === trimmed.toLowerCase());
    if (alreadyCovered) return null;

    // Create an adaptively learned rule
    const escapedPattern = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const autoCategory = category || "Adaptive Dynamic Attack";
    const autoRuleName = `Auto-Learned Pattern (${ruleName || 'Intercepted Attack'})`;

    return this.addRule(
      autoCategory,
      autoRuleName,
      escapedPattern,
      "HIGH",
      `Adaptively learned rule automatically generated from user attack attempt: "${trimmed.substring(0, 50)}..."`
    );
  },

  importDataset(datasetData) {
    let items = [];
    if (typeof datasetData === 'string') {
      try {
        items = JSON.parse(datasetData);
      } catch (e) {
        throw new Error("Invalid JSON file format");
      }
    } else if (Array.isArray(datasetData)) {
      items = datasetData;
    } else if (datasetData && Array.isArray(datasetData.rules)) {
      items = datasetData.rules;
    }

    if (!Array.isArray(items)) {
      throw new Error("Dataset JSON must be an array of rule objects or contain a 'rules' array.");
    }

    let addedCount = 0;
    items.forEach((item, idx) => {
      let cat = item.category || "Imported Security Dataset";
      let name = item.ruleName || item.name || `Dataset Rule #${idx + 1}`;
      let pattern = item.pattern || item.patternText || item.prompt || item.keyword;
      let risk = (item.risk || "HIGH").toUpperCase();
      let desc = item.description || "Imported from JSON security dataset.";

      if (pattern && typeof pattern === 'string' && pattern.trim().length > 0) {
        // Prevent duplicate exact patterns
        const exists = this.rules.some(r => r.patternText.toLowerCase() === pattern.trim().toLowerCase());
        if (!exists) {
          this.addRule(cat, name, pattern.trim(), risk, desc);
          addedCount++;
        }
      }
    });

    return addedCount;
  },

  deleteRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.saveRules();
  },

  getRules() {
    return this.rules;
  },

  evaluate(prompt) {
    if (!prompt || typeof prompt !== 'string') return { detected: false };

    const lowerPrompt = prompt.toLowerCase();

    for (const rule of this.rules) {
      if (!rule.patternText) continue;

      let isMatch = false;

      // Try regex match first, fallback to lowercase substring match
      try {
        const regex = new RegExp(rule.patternText, 'i');
        if (regex.test(prompt)) {
          isMatch = true;
        }
      } catch (e) {
        if (lowerPrompt.includes(rule.patternText.toLowerCase())) {
          isMatch = true;
        }
      }

      if (isMatch) {
        return {
          detected: true,
          category: rule.category,
          ruleName: rule.ruleName,
          risk: rule.risk,
          description: rule.description
        };
      }
    }

    return { detected: false };
  }
};

// Auto-start remote rule sync on page load
window.AdaptiveEngine.startRemoteSync();
