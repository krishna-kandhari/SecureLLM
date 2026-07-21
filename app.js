/**
 * Groq AI Minimal Studio - Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const sidebar = document.getElementById('sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnNewChat = document.getElementById('btn-new-chat');
  const chatHistoryList = document.getElementById('chat-history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  
  const modelSelect = document.getElementById('model-select');
  const apiStatusBadge = document.getElementById('api-status-badge');
  const apiStatusText = document.getElementById('api-status-text');
  
  const messagesContainer = document.getElementById('messages-container');
  const messagesInner = document.getElementById('messages-inner');
  const welcomeContainer = document.getElementById('welcome-container');
  
  const chatTextarea = document.getElementById('chat-textarea');
  const btnSend = document.getElementById('btn-send');
  const btnStop = document.getElementById('btn-stop');
  
  // Settings Modal Elements
  const settingsModal = document.getElementById('settings-modal');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-key');
  const systemPromptInput = document.getElementById('system-prompt-input');
  const temperatureInput = document.getElementById('temperature-input');
  const tempValDisplay = document.getElementById('temp-val-display');

  // Lock Screen Overlay Elements
  const lockOverlay = document.getElementById('lock-overlay');
  const authPasswordInput = document.getElementById('auth-password-input');
  const btnUnlockApp = document.getElementById('btn-unlock-app');
  const lockErrorMsg = document.getElementById('lock-error-msg');

  // --- State Variables ---
  const defaultConfig = (typeof CONFIG !== 'undefined' ? CONFIG : (window.CONFIG || {}));
  let sessionKey = sessionStorage.getItem('groq_unlocked_key');
  let storedKey = localStorage.getItem('groq_api_key');
  let apiKey = sessionKey || ((storedKey && storedKey.trim().length > 0) ? storedKey.trim() : (defaultConfig.DEFAULT_GROQ_API_KEY || ''));
  let systemPrompt = localStorage.getItem('groq_system_prompt') || defaultConfig.DEFAULT_SYSTEM_PROMPT || 'You are a helpful, smart, and ultra-fast AI assistant.';
  let temperature = parseFloat(localStorage.getItem('groq_temperature') || defaultConfig.DEFAULT_TEMPERATURE || '0.7');
  let selectedModel = localStorage.getItem('groq_selected_model') || defaultConfig.DEFAULT_MODEL || 'llama-3.3-70b-versatile';
  
  let chats = JSON.parse(localStorage.getItem('groq_chats_history') || '[]');
  let currentChatId = null;
  let activeAbortController = null;

  // --- Initialize Marked Renderer Options ---
  if (window.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        if (window.hljs) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
        return code;
      }
    });
  }

  // --- Cryptography & Lock Protection for Settings ---
  async function hashPassword(pass) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pass));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- Admin Password Authorization Helper ---
  async function verifyAdminAuth(forcePrompt = false) {
    if (!forcePrompt && sessionStorage.getItem('groq_app_auth') === 'true') {
      return true;
    }

    const inputPass = prompt('Enter Security Password:');
    if (!inputPass) return false;

    const hash = await hashPassword(inputPass.trim());
    if (hash === defaultConfig.PASSWORD_HASH) {
      sessionStorage.setItem('groq_app_auth', 'true');
      return true;
    } else {
      alert('Access Denied: Incorrect Password.');
      return false;
    }
  }

  async function decryptApiKey(pass, ivHex, encHex) {
    const passBuf = new TextEncoder().encode(pass);
    const keyHash = await crypto.subtle.digest("SHA-256", passBuf);
    const aesKey = await crypto.subtle.importKey("raw", keyHash, { name: "AES-CBC" }, false, ["decrypt"]);
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const encBuf = new Uint8Array(encHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const decryptedBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: iv }, aesKey, encBuf);
    return new TextDecoder().decode(decryptedBuf);
  }

  // Auto-decrypt key in background so everyone can use the chatbot
  async function ensureApiKeyLoaded() {
    if (apiKey && apiKey.length > 10) return;
    try {
      if (defaultConfig.ENCRYPTED_KEY_PAYLOAD && defaultConfig.ENCRYPTED_KEY_IV) {
        apiKey = await decryptApiKey("Krishna@9522@#$$", defaultConfig.ENCRYPTED_KEY_IV, defaultConfig.ENCRYPTED_KEY_PAYLOAD);
      }
    } catch (err) {
      console.warn("Auto-decryption of default key failed:", err);
    }
  }

  // --- Initialization ---
  async function init() {
    await ensureApiKeyLoaded();

    // Set UI values from state
    apiKeyInput.value = apiKey;
    systemPromptInput.value = systemPrompt;
    temperatureInput.value = temperature;
    tempValDisplay.textContent = temperature;
    modelSelect.value = selectedModel;

    updateApiStatus();
    renderChatHistory();

    if (chats.length > 0) {
      loadChat(chats[0].id);
    } else {
      createNewChat(false);
    }
  }

  // --- API Status Helper ---
  function updateApiStatus() {
    if (apiKey && apiKey.trim().length > 10) {
      apiStatusBadge.classList.add('connected');
      apiStatusText.textContent = 'API Connected';
    } else {
      apiStatusBadge.classList.remove('connected');
      apiStatusText.textContent = 'Set API Key';
    }
  }

  // --- Settings Modal Handlers ---
  let isKeyUnlocked = false;

  function openModal() {
    apiKeyInput.value = apiKey;
    apiKeyInput.type = 'password';
    isKeyUnlocked = false;
    btnToggleKey.textContent = 'Show';
    systemPromptInput.value = systemPrompt;
    temperatureInput.value = temperature;
    tempValDisplay.textContent = temperature;
    
    const remoteLogUrlInput = document.getElementById('remote-log-url-input');
    if (remoteLogUrlInput) {
      remoteLogUrlInput.value = localStorage.getItem('secure_llm_remote_log_url') || defaultConfig.REMOTE_LOGGING_URL || '';
    }

    settingsModal.classList.add('open');
  }

  function closeModal() {
    settingsModal.classList.remove('open');
  }

  btnOpenSettings.addEventListener('click', openModal);
  apiStatusBadge.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelSettings.addEventListener('click', closeModal);
  
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeModal();
  });

  btnToggleKey.addEventListener('click', async () => {
    if (apiKeyInput.type === 'text') {
      apiKeyInput.type = 'password';
      btnToggleKey.textContent = 'Show';
      return;
    }

    if (!isKeyUnlocked) {
      const pass = prompt('Enter the Password to reveal the API key:');
      if (!pass) return;
      const hash = await hashPassword(pass.trim());
      if (hash === defaultConfig.PASSWORD_HASH) {
        isKeyUnlocked = true;
        apiKeyInput.type = 'text';
        btnToggleKey.textContent = 'Hide';
      } else {
        alert('Incorrect password. Access denied.');
      }
    } else {
      apiKeyInput.type = 'text';
      btnToggleKey.textContent = 'Hide';
    }
  });

  temperatureInput.addEventListener('input', (e) => {
    tempValDisplay.textContent = e.target.value;
  });

  btnSaveSettings.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    systemPrompt = systemPromptInput.value.trim() || 'You are a helpful, smart, and ultra-fast AI assistant.';
    temperature = parseFloat(temperatureInput.value);

    localStorage.setItem('groq_api_key', apiKey);
    localStorage.setItem('groq_system_prompt', systemPrompt);
    localStorage.setItem('groq_temperature', temperature.toString());

    const remoteLogUrlInput = document.getElementById('remote-log-url-input');
    if (remoteLogUrlInput) {
      const url = remoteLogUrlInput.value.trim();
      localStorage.setItem('secure_llm_remote_log_url', url);
      defaultConfig.REMOTE_LOGGING_URL = url;
    }

    updateApiStatus();
    closeModal();
  });

  // --- Model Selector Handler ---
  modelSelect.addEventListener('change', (e) => {
    selectedModel = e.target.value;
    localStorage.setItem('groq_selected_model', selectedModel);
  });

  // --- Chat State Management ---
  function saveChats() {
    localStorage.setItem('groq_chats_history', JSON.stringify(chats));
  }

  function createNewChat(switchToIt = true) {
    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: []
    };
    chats.unshift(newChat);
    saveChats();
    renderChatHistory();
    if (switchToIt) {
      loadChat(newChat.id);
    }
  }

  function loadChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    renderChatHistory();

    // Clear current DOM messages
    messagesInner.innerHTML = '';

    if (!chat || chat.messages.length === 0) {
      messagesInner.appendChild(welcomeContainer);
      welcomeContainer.style.display = 'flex';
    } else {
      welcomeContainer.style.display = 'none';
      chat.messages.forEach(msg => {
        appendMessageToDom(msg.role, msg.content, false);
      });
    }

    scrollToBottom();
  }

  function deleteChat(chatId, e) {
    e.stopPropagation();
    chats = chats.filter(c => c.id !== chatId);
    saveChats();
    if (currentChatId === chatId) {
      if (chats.length > 0) {
        loadChat(chats[0].id);
      } else {
        createNewChat(true);
      }
    } else {
      renderChatHistory();
    }
  }

  function renderChatHistory() {
    chatHistoryList.innerHTML = '';
    chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'history-title';
      titleSpan.textContent = chat.title || 'New Chat';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-chat';
      delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      delBtn.addEventListener('click', (e) => deleteChat(chat.id, e));

      item.appendChild(titleSpan);
      item.appendChild(delBtn);
      item.addEventListener('click', () => loadChat(chat.id));
      
      chatHistoryList.appendChild(item);
    });
  }

  btnNewChat.addEventListener('click', () => createNewChat(true));

  btnClearHistory.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
      chats = [];
      saveChats();
      createNewChat(true);
    }
  });

  // Sidebar toggle & mobile outside click dismissal
  btnToggleSidebar.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !btnToggleSidebar.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Suggestion Cards Trigger
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        chatTextarea.value = prompt;
        updateTextareaHeight();
        handleSendMessage();
      }
    });
  });

  // --- Textarea & Input Auto-Resizing ---
  function updateTextareaHeight() {
    chatTextarea.style.height = 'auto';
    chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 180) + 'px';
    btnSend.disabled = chatTextarea.value.trim().length === 0;
  }

  chatTextarea.addEventListener('input', updateTextareaHeight);

  chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  btnSend.addEventListener('click', handleSendMessage);

  btnStop.addEventListener('click', () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
      setGeneratingState(false);
    }
  });

  function setGeneratingState(isGenerating) {
    if (isGenerating) {
      btnSend.style.display = 'none';
      btnStop.style.display = 'flex';
      chatTextarea.disabled = true;
    } else {
      btnSend.style.display = 'flex';
      btnStop.style.display = 'none';
      chatTextarea.disabled = false;
      chatTextarea.focus();
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // --- Message UI Rendering ---
  function appendMessageToDom(role, content = '', isStreaming = false) {
    welcomeContainer.style.display = 'none';

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (role === 'user') {
      avatar.textContent = 'U';
    } else {
      avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'message-content-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = renderMarkdown(content);
      if (isStreaming) {
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        bubble.appendChild(cursor);
      }
    }

    wrapper.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(wrapper);

    messagesInner.appendChild(row);
    scrollToBottom();

    // Attach copy actions to any code blocks created
    enhanceCodeBlocks(bubble);

    return { row, bubble };
  }

  function renderMarkdown(rawText) {
    if (window.marked) {
      return marked.parse(rawText);
    }
    return rawText.replace(/\n/g, '<br>');
  }

  function enhanceCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

      const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
      const langName = langClass ? langClass.replace('language-', '') : 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `<span>${langName}</span><button class="btn-copy-code"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button>`;

      const copyBtn = header.querySelector('.btn-copy-code');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeEl.textContent);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        }, 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      if (window.hljs) {
        hljs.highlightElement(codeEl);
      }
    });
  }

  // --- Groq API Streaming Logic ---
  async function handleSendMessage() {
    const userText = chatTextarea.value.trim();
    if (!userText) return;

    // Reset textarea immediately
    chatTextarea.value = '';
    updateTextareaHeight();

    // --- Defense Engine Security Interception & Logging (ALWAYS RUNS FOR EVERY ENTRY) ---
    let securityCheck = { isSafe: true };
    if (window.SafeVerifier) {
      securityCheck = window.SafeVerifier.verify(userText);
    }

    // Always log evaluation result to Security Audit Logger
    if (window.SecurityLogger) {
      window.SecurityLogger.logEntry(userText, securityCheck);
    }

    if (!apiKey) {
      const cfg = (typeof CONFIG !== 'undefined' ? CONFIG : (window.CONFIG || {}));
      apiKey = cfg.DEFAULT_GROQ_API_KEY || '';
    }

    if (!apiKey) {
      appendMessageToDom('user', userText);
      const { bubble } = appendMessageToDom('assistant', '', false);
      bubble.innerHTML = `<div style="color: #f87171; font-weight: 500; display: flex; align-items: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg><span>Groq API key is missing. Please click <strong>Settings</strong> at the bottom left to configure your API key.</span></div>`;
      return;
    }

    if (!securityCheck.isSafe) {
      appendMessageToDom('user', userText);
      const { bubble } = appendMessageToDom('assistant', '', false);
      
      bubble.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px; color: #f87171;">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444; flex-shrink: 0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Defense Engine Intercepted</span>
            <span style="font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); padding: 2px 8px; border-radius: 99px; color: #ef4444;">${securityCheck.risk} RISK</span>
          </div>
          <div style="font-size: 0.85rem; color: #fca5a5; margin-bottom: 6px;">
            <strong>Category:</strong> ${securityCheck.category} (${securityCheck.ruleName})
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
            ${securityCheck.description} This request was blocked by Secure LLM safety policies.
          </div>
        </div>
      `;
      return;
    }

    // Ensure chat session
    let chat = chats.find(c => c.id === currentChatId);
    if (!chat) {
      createNewChat(false);
      chat = chats[0];
    }

    // Add title if first message
    if (chat.messages.length === 0) {
      chat.title = userText.length > 30 ? userText.substring(0, 30) + '...' : userText;
      renderChatHistory();
    }

    // Save user message to chat state
    chat.messages.push({ role: 'user', content: userText });
    saveChats();

    // Render User message
    appendMessageToDom('user', userText);

    // Prepare assistant message slot
    setGeneratingState(true);
    const { bubble } = appendMessageToDom('assistant', '', true);

    activeAbortController = new AbortController();

    // Prepare API messages payload
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...chat.messages.map(m => ({ role: m.role, content: m.content }))
    ];

    let fullAssistantResponse = '';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          temperature: temperature,
          stream: true
        }),
        signal: activeAbortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Groq API Error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            break;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.replace('data: ', ''));
              const deltaContent = json.choices?.[0]?.delta?.content || '';
              if (deltaContent) {
                fullAssistantResponse += deltaContent;
                bubble.innerHTML = renderMarkdown(fullAssistantResponse);
                const cursor = document.createElement('span');
                cursor.className = 'typing-cursor';
                bubble.appendChild(cursor);
                scrollToBottom();
              }
            } catch (err) {
              console.warn('Error parsing SSE chunk', err, line);
            }
          }
        }
      }

      // Remove typing cursor & finalize message
      bubble.innerHTML = renderMarkdown(fullAssistantResponse);
      enhanceCodeBlocks(bubble);

      // Save assistant message to chat
      chat.messages.push({ role: 'assistant', content: fullAssistantResponse });
      saveChats();

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream generation aborted by user.');
        if (fullAssistantResponse) {
          chat.messages.push({ role: 'assistant', content: fullAssistantResponse + ' *(Stopped)*' });
          saveChats();
        }
      } else {
        console.error('Groq Chat Error:', err);
        bubble.innerHTML = `<div style="color: #f87171; font-weight: 500; display: flex; align-items: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg><span>${err.message}</span></div>`;
      }
    } finally {
      activeAbortController = null;
      setGeneratingState(false);
      scrollToBottom();
    }
  }

  // --- Security Audit Dashboard & Adaptive Controls ---
  const auditModal = document.getElementById('audit-modal');
  const btnOpenAudit = document.getElementById('btn-open-audit');
  const btnCloseAudit = document.getElementById('btn-close-audit');
  const btnCloseAuditFooter = document.getElementById('btn-close-audit-footer');
  const btnClearAuditLogs = document.getElementById('btn-clear-audit-logs');
  const btnExportAuditJson = document.getElementById('btn-export-audit-json');
  const auditTableBody = document.getElementById('audit-table-body');
  const statTotalLogs = document.getElementById('stat-total-logs');
  const statAttacksBlocked = document.getElementById('stat-attacks-blocked');
  const statSafePassed = document.getElementById('stat-safe-passed');

  // Tabs
  const tabBtnLogs = document.getElementById('tab-btn-logs');
  const tabBtnRules = document.getElementById('tab-btn-rules');
  const tabViewLogs = document.getElementById('tab-view-logs');
  const tabViewRules = document.getElementById('tab-view-rules');

  // Rule Form Elements
  const newRuleCategory = document.getElementById('new-rule-category');
  const newRuleName = document.getElementById('new-rule-name');
  const newRulePattern = document.getElementById('new-rule-pattern');
  const newRuleRisk = document.getElementById('new-rule-risk');
  const btnAddAdaptiveRule = document.getElementById('btn-add-adaptive-rule');
  const adaptiveRulesTableBody = document.getElementById('adaptive-rules-table-body');

  let liveAuditTimer = null;
  let lastKnownLogCount = 0;

  async function openAuditModal() {
    const isAuth = await verifyAdminAuth(true);
    if (!isAuth) return;
    lastKnownLogCount = 0; // Force full render on open
    renderAuditTable();
    renderAdaptiveRulesTable();
    if (auditModal) auditModal.classList.add('open');

    // Start Live Feed Auto-Refresh — only adds NEW entries, never rebuilds existing rows
    if (!liveAuditTimer) {
      liveAuditTimer = setInterval(async () => {
        if (auditModal && auditModal.classList.contains('open') && tabViewLogs.style.display !== 'none') {
          // Fetch latest logs silently
          if (typeof window.SecurityLogger.fetchRemoteLogs === 'function') {
            await window.SecurityLogger.fetchRemoteLogs();
          }
          const logs = window.SecurityLogger.getLogs();
          // Only re-render if new logs arrived
          if (logs.length !== lastKnownLogCount) {
            renderAuditTable();
          }
        }
      }, 3000);
    }
  }

  function closeAuditModal() {
    if (auditModal) auditModal.classList.remove('open');
    if (liveAuditTimer) {
      clearInterval(liveAuditTimer);
      liveAuditTimer = null;
    }
  }

  // Tab Switching
  if (tabBtnLogs && tabBtnRules) {
    tabBtnLogs.addEventListener('click', () => {
      tabBtnLogs.classList.add('active');
      tabBtnRules.classList.remove('active');
      tabViewLogs.style.display = 'block';
      tabViewRules.style.display = 'none';
      renderAuditTable();
    });

    tabBtnRules.addEventListener('click', () => {
      tabBtnRules.classList.add('active');
      tabBtnLogs.classList.remove('active');
      tabViewRules.style.display = 'block';
      tabViewLogs.style.display = 'none';
      renderAdaptiveRulesTable();
    });
  }

  const availableCategories = [
    "Safe Query",
    "Whitelisted Exemption",
    "Prompt Injection Attack",
    "Jailbreak Attack",
    "Prompt Leakage Attack",
    "Malicious Roleplay Attack",
    "Data Extraction Attack",
    "Data Poisoning Attack",
    "Custom Security Rule"
  ];

  async function renderAuditTable() {
    if (!window.SecurityLogger || !auditTableBody) return;
    if (typeof window.SecurityLogger.fetchRemoteLogs === 'function') {
      await window.SecurityLogger.fetchRemoteLogs();
    }
    const logs = window.SecurityLogger.getLogs();
    
    let blockedCount = 0;
    let safeCount = 0;

    auditTableBody.innerHTML = '';

    if (logs.length === 0) {
      auditTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 24px;">No security logs recorded yet.</td></tr>`;
    } else {
      logs.forEach((item, index) => {
        if (item.isSafe) safeCount++; else blockedCount++;

        const tr = document.createElement('tr');
        const escapedPrompt = (item.prompt || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Category options for adaptive reclassification
        const categoryOptionsHtml = availableCategories.map(cat => 
          `<option value="${cat}" ${cat === item.category ? 'selected' : ''}>${cat}</option>`
        ).join('');

        tr.innerHTML = `
          <td style="color: var(--text-muted); font-size: 0.75rem;">${item.timestamp}</td>
          <td><span class="badge-risk ${item.risk}">${item.risk}</span></td>
          <td style="font-weight: 500;">${item.category}</td>
          <td>
            <select class="select-category-edit" data-index="${index}">
              ${categoryOptionsHtml}
            </select>
          </td>
          <td>
            <div class="prompt-cell" title="Click to view full prompt detail">
              <div class="prompt-cell-header">
                <span>Prompt (${(item.prompt || '').length} chars)</span>
                <button class="btn-expand-prompt" type="button">Expand</button>
              </div>
              <div class="prompt-text-body">${escapedPrompt}</div>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <button class="btn-admin-block" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; cursor: pointer;">Block & Learn</button>
              <button class="btn-admin-whitelist" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); color: #34d399; cursor: pointer;">Whitelist</button>
            </div>
          </td>
        `;

        const promptCellEl = tr.querySelector('.prompt-cell');
        if (promptCellEl) {
          promptCellEl.addEventListener('click', () => {
            openPromptViewModal(item);
          });
        }

        const btnBlock = tr.querySelector('.btn-admin-block');
        if (btnBlock) {
          btnBlock.addEventListener('click', async () => {
            const isAuth = await verifyAdminAuth();
            if (!isAuth) return;
            if (window.AdaptiveEngine) {
              const rule = window.AdaptiveEngine.autoAdaptFromAttack(item.prompt, item.category, "Admin Block Decision");
              alert(`Rule created & activated for pattern: "${(item.prompt || '').substring(0, 30)}..."`);
              renderAuditTable();
            }
          });
        }

        const btnWhitelist = tr.querySelector('.btn-admin-whitelist');
        if (btnWhitelist) {
          btnWhitelist.addEventListener('click', async () => {
            const isAuth = await verifyAdminAuth();
            if (!isAuth) return;
            if (window.AdaptiveEngine) {
              window.AdaptiveEngine.whitelistPrompt(item.prompt);
              item.isSafe = true;
              item.risk = "WHITELISTED";
              item.category = "Whitelisted Exemption";
              renderAuditTable();
              alert(`Prompt whitelisted successfully!`);
            }
          });
        }

        // Handle category reclassification on change & adaptively train engine / whitelist
        const selectEl = tr.querySelector('.select-category-edit');
        selectEl.addEventListener('change', async (e) => {
          const isAuth = await verifyAdminAuth();
          if (!isAuth) {
            e.target.value = item.category;
            return;
          }

          const newCategory = e.target.value;
          item.category = newCategory;

          if (newCategory === "Whitelisted Exemption" || newCategory === "Safe Query") {
            item.isSafe = true;
            item.risk = newCategory === "Whitelisted Exemption" ? "WHITELISTED" : "SAFE";
            if (window.AdaptiveEngine) {
              window.AdaptiveEngine.whitelistPrompt(item.prompt);
            }
          } else {
            item.isSafe = false;
            item.risk = "HIGH";
            if (window.AdaptiveEngine) {
              window.AdaptiveEngine.removeWhitelist(item.prompt);
              // Auto-train AdaptiveEngine: register this prompt pattern as an active rule
              if (item.prompt) {
                const ruleName = `Learned Pattern`;
                const escapedPattern = item.prompt.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                window.AdaptiveEngine.addRule(
                  newCategory,
                  ruleName,
                  escapedPattern,
                  "HIGH",
                  `Adaptively learned rule for category ${newCategory}`
                );
              }
            }
          }
          localStorage.setItem('secure_llm_security_logs', JSON.stringify(logs));
          renderAuditTable();
        });

        auditTableBody.appendChild(tr);
      });
    }

    if (statTotalLogs) statTotalLogs.textContent = `Total: ${logs.length}`;
    if (statAttacksBlocked) statAttacksBlocked.textContent = `Attacks Blocked: ${blockedCount}`;
    if (statSafePassed) statSafePassed.textContent = `Safe Queries: ${safeCount}`;
    lastKnownLogCount = logs.length;
  }

  function renderAdaptiveRulesTable() {
    if (!window.AdaptiveEngine || !adaptiveRulesTableBody) return;
    const rules = window.AdaptiveEngine.getRules();
    
    adaptiveRulesTableBody.innerHTML = '';

    if (rules.length === 0) {
      adaptiveRulesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 20px;">No custom adaptive rules created yet.</td></tr>`;
    } else {
      rules.forEach(rule => {
        const tr = document.createElement('tr');
        const escapedPattern = (rule.patternText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        tr.innerHTML = `
          <td style="font-weight: 500;">${rule.category}</td>
          <td style="color: var(--text-muted);">${rule.ruleName}</td>
          <td style="font-family: var(--font-code); font-size: 0.75rem;">${escapedPattern}</td>
          <td><span class="badge-risk ${rule.risk}">${rule.risk}</span></td>
          <td>
            <button class="btn-delete-rule" data-id="${rule.id}" style="color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.75rem;">Delete</button>
          </td>
        `;

        tr.querySelector('.btn-delete-rule').addEventListener('click', async () => {
          const isAuth = await verifyAdminAuth();
          if (!isAuth) return;
          window.AdaptiveEngine.deleteRule(rule.id);
          renderAdaptiveRulesTable();
        });

        adaptiveRulesTableBody.appendChild(tr);
      });
    }
  }

  // Add Dynamic Adaptive Rule Handler
  if (btnAddAdaptiveRule) {
    btnAddAdaptiveRule.addEventListener('click', async () => {
      const isAuth = await verifyAdminAuth();
      if (!isAuth) return;

      const cat = newRuleCategory.value.trim();
      const name = newRuleName.value.trim();
      const pattern = newRulePattern.value.trim();
      const risk = newRuleRisk.value;

      if (!cat || !name || !pattern) {
        alert('Please fill out Category Name, Rule Name, and Pattern/Keyword.');
        return;
      }

      if (window.AdaptiveEngine) {
        window.AdaptiveEngine.addRule(cat, name, pattern, risk);
        newRuleCategory.value = '';
        newRuleName.value = '';
        newRulePattern.value = '';
        renderAdaptiveRulesTable();
        alert(`Rule "${name}" added successfully and activated!`);
      }
    });
  }

  // Import JSON Dataset File Handler
  const btnImportDatasetJson = document.getElementById('btn-import-dataset-json');
  const inputImportDatasetJson = document.getElementById('input-import-dataset-json');

  if (btnImportDatasetJson && inputImportDatasetJson) {
    btnImportDatasetJson.addEventListener('click', async () => {
      const isAuth = await verifyAdminAuth();
      if (!isAuth) return;
      inputImportDatasetJson.click();
    });

    inputImportDatasetJson.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const jsonContent = evt.target.result;
          if (window.AdaptiveEngine) {
            const count = window.AdaptiveEngine.importDataset(jsonContent);
            renderAdaptiveRulesTable();
            alert(`Successfully imported ${count} new security dataset rule(s)!`);
          }
        } catch (err) {
          alert(`Failed to import JSON dataset: ${err.message}`);
        } finally {
          inputImportDatasetJson.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnOpenAudit) btnOpenAudit.addEventListener('click', openAuditModal);
  if (btnCloseAudit) btnCloseAudit.addEventListener('click', closeAuditModal);
  if (btnCloseAuditFooter) btnCloseAuditFooter.addEventListener('click', closeAuditModal);

  if (auditModal) {
    auditModal.addEventListener('click', (e) => {
      if (e.target === auditModal) closeAuditModal();
    });
  }

  if (btnClearAuditLogs) {
    btnClearAuditLogs.addEventListener('click', async () => {
      const isAuth = await verifyAdminAuth();
      if (!isAuth) return;

      if (confirm('Clear all security audit logs?')) {
        if (window.SecurityLogger) window.SecurityLogger.clearLogs();
        renderAuditTable();
      }
    });
  }

  if (btnExportAuditJson) {
    btnExportAuditJson.addEventListener('click', async () => {
      const isAuth = await verifyAdminAuth();
      if (!isAuth) return;
      if (window.SecurityLogger) window.SecurityLogger.exportJSON();
    });
  }

  // --- Full Prompt Detail Modal Handlers ---
  const promptViewModal = document.getElementById('prompt-view-modal');
  const promptViewContent = document.getElementById('prompt-view-content');
  const promptViewMeta = document.getElementById('prompt-view-meta');
  const btnClosePromptModal = document.getElementById('btn-close-prompt-modal');
  const btnClosePromptModalFooter = document.getElementById('btn-close-prompt-modal-footer');
  const btnCopyPromptText = document.getElementById('btn-copy-prompt-text');
  const btnCopyPromptLabel = document.getElementById('btn-copy-prompt-label');
  let activePromptToCopy = '';

  function openPromptViewModal(logItem) {
    if (!promptViewModal || !promptViewContent) return;
    activePromptToCopy = logItem.prompt || '';
    
    if (promptViewMeta) {
      promptViewMeta.innerHTML = `
        <span><strong>Timestamp:</strong> ${logItem.timestamp}</span>
        <span><strong>Risk:</strong> <span class="badge-risk ${logItem.risk}">${logItem.risk}</span></span>
        <span><strong>Category:</strong> ${logItem.category}</span>
        <span><strong>Length:</strong> ${activePromptToCopy.length} characters</span>
      `;
    }
    
    promptViewContent.textContent = activePromptToCopy;
    promptViewModal.classList.add('open');
  }

  function closePromptViewModal() {
    if (promptViewModal) promptViewModal.classList.remove('open');
  }

  if (btnClosePromptModal) btnClosePromptModal.addEventListener('click', closePromptViewModal);
  if (btnClosePromptModalFooter) btnClosePromptModalFooter.addEventListener('click', closePromptViewModal);
  if (promptViewModal) {
    promptViewModal.addEventListener('click', (e) => {
      if (e.target === promptViewModal) closePromptViewModal();
    });
  }

  if (btnCopyPromptText) {
    btnCopyPromptText.addEventListener('click', () => {
      if (!activePromptToCopy) return;
      navigator.clipboard.writeText(activePromptToCopy).then(() => {
        if (btnCopyPromptLabel) {
          btnCopyPromptLabel.textContent = 'Copied!';
          setTimeout(() => {
            btnCopyPromptLabel.textContent = 'Copy Full Prompt';
          }, 2000);
        }
      });
    });
  }

  // Launch app
  init();
});
