/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GEMINIAPIKEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly VITE_GEMINIAPIKEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_QUIZ_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINIAPIKEY?: string;
    GEMINI_API_KEY?: string;
  }
}
