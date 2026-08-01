/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gates the checked-in development fixture (`api/fixture.ts`). Never set in production. */
  readonly VITE_HQ_FIXTURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
