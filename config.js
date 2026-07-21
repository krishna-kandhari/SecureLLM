/**
 * Groq Chatbot Configuration - Password Protected
 */

window.CONFIG = {
  // Password Protection Security Configuration
  REQUIRES_PASSWORD: true,
  PASSWORD_HASH: "1d05e9746a417177ac709f2b3af324212041dd92775d4d9bee575c3b010083d2",
  ENCRYPTED_KEY_IV: "094dda0b7856560abcbf69eaa5296604",
  ENCRYPTED_KEY_PAYLOAD: "edb61517046e0b11ad33743a225ae9c7da8a85fce534da8c04dfba6ac8367669ca095664741b2997487db3af20c57ee95154ad1fffd2c19cc78eb62909fb2a69",

  // App Name & System Prompt
  APP_NAME: "Secure LLM",
  DEFAULT_SYSTEM_PROMPT: "You are Secure LLM, a helpful, smart, and ultra-fast AI assistant.",

  // Default Groq AI Model
  DEFAULT_MODEL: "llama-3.3-70b-versatile",

  // Default temperature (0.0 to 1.0)
  DEFAULT_TEMPERATURE: 0.7,

  // Remote Cloud Audit Logging URL (e.g. /api/logs, Supabase, Firebase, or Webhook endpoint)
  REMOTE_LOGGING_URL: localStorage.getItem('secure_llm_remote_log_url') || "/api/logs",
  REMOTE_LOGGING_KEY: localStorage.getItem('secure_llm_remote_log_key') || ""
};
