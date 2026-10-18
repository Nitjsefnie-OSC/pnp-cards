/** Descarga una URL (normalmente de un Blob) con el nombre de archivo dado. */
export function downloadUrl(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

/** Descarga un Blob y libera su URL después. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
