/// <reference types="vite/client" />

/** Versión de package.json (`define` en vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Código de la cuenta de GoatCounter; sin él, no se envían estadísticas. */
  readonly VITE_GOATCOUNTER_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
