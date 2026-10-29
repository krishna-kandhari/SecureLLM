/**
 * Groq Chatbot Configuration - Password Protected
 */

window.CONFIG = {
  // Password Protection Security Configuration (Password: Krishna@3960)
  REQUIRES_PASSWORD: true,
  PASSWORD_HASH: "7615f69fd6c78ebe5e9493a516c6071dd33a9341cbdb7c99209859357b06d6a7",
  ENCRYPTED_KEY_IV: "9938953fabed86cb29d83637841173ba",
  ENCRYPTED_KEY_PAYLOAD: "57797a601a6df6aa9706f8f5091e0a8ae1db6f6ca4a396c78522845143bf9d424f79c8d661bbf01daff3474f216335d162bb5707937a6b472766348873e84d03",

  // App Name & System Prompt
  APP_NAME: "Secure LLM",
  DEFAULT_SYSTEM_PROMPT: "You are Secure LLM, a helpful, smart, and ultra-fast AI assistant protected by real-time defense layers.",

  // Single Active & Verified Groq AI Model
  DEFAULT_MODEL: "qwen/qwen3.8-27b",

  // Default temperature (0.0 to 1.0)
  DEFAULT_TEMPERATURE: 0.7,

  // Remote Cloud Audit Logging URL (e.g. /api/logs, Supabase, Firebase, or Webhook endpoint)
  REMOTE_LOGGING_URL: localStorage.getItem('secure_llm_remote_log_url') || "/api/logs",
  REMOTE_LOGGING_KEY: localStorage.getItem('secure_llm_remote_log_key') || ""
};
