// src/utils/env.ts

// Tell TypeScript about our global window object
declare global {
  interface Window {
    __RUNTIME_ENV__: {
      SUPABASE_URL: string;
      SUPABASE_PUBLISHABLE_KEY: string;
    };
  }
}

export const getEnv = (key: keyof Window['__RUNTIME_ENV__']): string => {
  // Server-side (Nitro/Node.js)
  if (typeof window === 'undefined') {
    return process.env[key] || process.env[`VITE_${key}`] || '';
  }
  
  // Client-side (Browser)
  return window.__RUNTIME_ENV__?.[key] || '';
};
