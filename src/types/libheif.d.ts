/** Lo que se usa de libheif-js (su libheif.d.ts no declara HeifDecoder ni HeifImage). */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      done: (result: { data: Uint8ClampedArray; width: number; height: number } | null) => void,
    ): void;
    free(): void;
  }

  interface HeifDecoder {
    /** Contexto de libheif del último `decode`. */
    decoder: number | null;
    decode(data: Uint8Array): HeifImage[];
  }

  interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
    heif_context_free(context: number): void;
  }

  export default function libheif(options?: unknown): LibHeif;
}
