/** Empaqueta archivos en un ZIP (sin volver a comprimir: imágenes y PDF ya lo están). */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob, { compression: 'STORE' });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}
