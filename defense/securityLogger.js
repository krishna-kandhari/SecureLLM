/**
 * Defense Engine - Security Audit Logger
 * Logs, tags, and exports all user prompt evaluations and attack classifications.
 */

window.SecurityLogger = {
  logs: JSON.parse(localStorage.getItem('secure_llm_security_logs') || '[]'),

  logEntry(promptText, verificationResult) {
    const isSafe = verificationResult && verificationResult.isSafe;
    
    const logItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
      isoDate: new Date().toISOString(),
      prompt: promptText,
      isSafe: isSafe,
      category: isSafe ? 'Safe Query' : verificationResult.category,
      ruleName: isSafe ? 'Passed All Checks' : verificationResult.ruleName,
      risk: isSafe ? 'SAFE' : verificationResult.risk,
      description: isSafe ? 'No malicious attack vectors detected.' : verificationResult.description
    };

    this.logs.unshift(logItem);
    
    // Cap at 200 logs to prevent localStorage overflow
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(0, 200);
    }

    try {
      localStorage.setItem('secure_llm_security_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn("Storage quota limit reached for security logs.", e);
    }

    // Send background sync to remote cloud database / webhook
    this.sendRemoteLog(logItem);

    return logItem;
  },

  async sendRemoteLog(logItem) {
    const remoteUrl = (window.CONFIG && window.CONFIG.REMOTE_LOGGING_URL) || localStorage.getItem('secure_llm_remote_log_url');
    const remoteKey = (window.CONFIG && window.CONFIG.REMOTE_LOGGING_KEY) || localStorage.getItem('secure_llm_remote_log_key');

    if (!remoteUrl) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (remoteKey) {
        headers['apikey'] = remoteKey;
        headers['Authorization'] = `Bearer ${remoteKey}`;
      }

      await fetch(remoteUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(logItem)
      });
    } catch (err) {
      console.warn("Failed to transmit audit log to remote cloud endpoint:", err);
    }
  },

  async fetchRemoteLogs() {
    const remoteUrl = (window.CONFIG && window.CONFIG.REMOTE_LOGGING_URL) || localStorage.getItem('secure_llm_remote_log_url');
    const remoteKey = (window.CONFIG && window.CONFIG.REMOTE_LOGGING_KEY) || localStorage.getItem('secure_llm_remote_log_key');

    if (!remoteUrl) return this.logs;

    try {
      const headers = {};
      if (remoteKey) {
        headers['apikey'] = remoteKey;
        headers['Authorization'] = `Bearer ${remoteKey}`;
      }

      const response = await fetch(remoteUrl, { method: 'GET', headers: headers });
      if (response.ok) {
        const remoteData = await response.json();
        if (Array.isArray(remoteData)) {
          const localIds = new Set(this.logs.map(l => l.id));
          remoteData.forEach(item => {
            if (item && item.id && !localIds.has(item.id)) {
              this.logs.push(item);
              localIds.add(item.id);
            }
          });
          this.logs.sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0));
          localStorage.setItem('secure_llm_security_logs', JSON.stringify(this.logs));
        }
      }
    } catch (e) {
      console.warn("Could not fetch remote cloud logs:", e);
    }

    return this.logs;
  },

  getLogs() {
    return this.logs;
  },

  clearLogs() {
    this.logs = [];
    localStorage.removeItem('secure_llm_security_logs');
  },

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `security_audit_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
};
