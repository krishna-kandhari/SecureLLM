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

  // Push full rules and whitelist state to remote server
  async syncStateToServer() {
    try {
      await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: this.rules,
          whitelist: this.whitelistedPrompts
        })
      });
    } catch (e) {
      console.warn('Failed to sync state to server:', e);
    }
  },

  async syncRuleToServer(rule) {
    this.syncStateToServer();
  },

  // Pull all rules and whitelist from the server and merge into local state (called on interval)
  async syncFromServer() {
    // STEP 1: Always re-read localStorage (catches cross-tab updates from admin)
    try {
      const storedRules = localStorage.getItem('secure_llm_adaptive_rules');
      if (storedRules) {
        const parsedRules = JSON.parse(storedRules);
        if (Array.isArray(parsedRules)) {
          this.rules = parsedRules;
        }
      }
      const storedWl = localStorage.getItem('secure_llm_whitelisted_prompts');
      if (storedWl) {
        const parsedWl = JSON.parse(storedWl);
        if (Array.isArray(parsedWl)) {
          this.whitelistedPrompts = parsedWl;
        }
      }
    } catch (e) {}

    // STEP 2: Fetch from server API (catches cross-device/cross-browser updates)
    try {
      const res = await fetch('/api/rules', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      
      let remoteRules = [];
      let remoteWl = [];

      if (Array.isArray(data)) {
        remoteRules = data;
      } else if (data) {
        remoteRules = Array.isArray(data.rules) ? data.rules : [];
        remoteWl = Array.isArray(data.whitelist) ? data.whitelist : [];
      }

      let changed = false;

      // Sync remote rules
      if (remoteRules.length > 0) {
        const currentIds = new Set(this.rules.map(r => r.id));
        for (const rule of remoteRules) {
          if (rule && rule.id && !currentIds.has(rule.id)) {
            this.rules.unshift(rule);
            currentIds.add(rule.id);
            changed = true;
          }
        }
      }

      // Sync remote whitelist
      if (remoteWl.length > 0) {
        for (const item of remoteWl) {
          if (item && !this.whitelistedPrompts.includes(item)) {
            this.whitelistedPrompts.unshift(item);
            changed = true;
          }
        }
      }

      if (changed) {
        this.saveRules();
        this.saveWhitelist();
      }
    } catch (e) {}
  },

  // Start a 2-second background sync loop for rules AND whitelists
  _syncTimer: null,
  startRemoteSync() {
    if (this._syncTimer) return;

    // Instant cross-tab sync: listen for localStorage changes from admin tab
    window.addEventListener('storage', (e) => {
      if (e.key === 'secure_llm_adaptive_rules' && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) this.rules = updated;
        } catch (err) {}
      }
      if (e.key === 'secure_llm_whitelisted_prompts' && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) this.whitelistedPrompts = updated;
        } catch (err) {}
      }
    });

    // Periodic sync from both localStorage and server
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

    // Immediately remove any blocking rule created for this prompt so unblocking takes effect instantly
    const escapedPattern = promptText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldLength = this.rules.length;
    this.rules = this.rules.filter(r => {
      if (!r || !r.patternText) return true;
      const rLower = r.patternText.toLowerCase();
      return rLower !== norm && rLower !== escapedPattern.toLowerCase();
    });
    if (this.rules.length !== oldLength) {
      this.saveRules();
    }

    this.syncStateToServer();
  },

  removeWhitelist(promptText) {
    if (!promptText) return;
    const norm = promptText.trim().toLowerCase();
    this.whitelistedPrompts = this.whitelistedPrompts.filter(p => p !== norm);
    this.saveWhitelist();
    this.syncStateToServer();
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
    this.syncStateToServer();
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
    this.syncStateToServer();
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
