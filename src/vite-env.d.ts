/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Código de la cuenta de GoatCounter; sin él, no se envían estadísticas. */
  readonly VITE_GOATCOUNTER_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
