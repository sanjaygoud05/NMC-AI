/**
 * Global API configuration for NMC-AI frontend.
 * In development, defaults to local FastAPI (http://localhost:8000).
 * In production builds (Vercel / Cloud), defaults to the live Render backend (https://nmc-ai.onrender.com).
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://nmc-ai.onrender.com' : 'http://localhost:8000');
