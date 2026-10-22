/** Calidad del JPG al convertir fotos HEIC (en PNG ocuparían muchísimo). */
export const HEIC_JPEG_QUALITY = 0.92;

export interface DecodedImage {
  width: number;
  height: number;
  /** Píxeles RGBA, fila a fila. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Decodifica la imagen principal de un HEIC/HEIF con libheif (WebAssembly, cargado bajo demanda).
 * libheif aplica el giro y el volteo de la foto (cajas `irot` e `imir`), así que sale derecha.
 */
export async function decodeHeic(bytes: Uint8Array): Promise<DecodedImage> {
  const libheif = (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default();
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  try {
    const image = images.find((i) => i.is_primary()) ?? images[0];
    if (!image) throw new Error('HEIC sin imágenes');
    const width = image.get_width();
    const height = image.get_height();
    const data = new Uint8ClampedArray(width * height * 4);
    const result = await new Promise<unknown>((resolve) =>
      image.display({ data, width, height }, resolve),
    );
    if (!result) throw new Error('No se ha podido decodificar el HEIC');
    return { width, height, data };
  } finally {
    for (const image of images) image.free();
    if (decoder.decoder) libheif.heif_context_free(decoder.decoder);
  }
}
