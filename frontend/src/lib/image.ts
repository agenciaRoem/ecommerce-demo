const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Reduce la foto antes de subirla: una foto de celular pesa varios MB y en el depósito la conexión
 * puede ser mala. El backend igualmente genera sus propias variantes optimizadas.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file); // respeta la orientación EXIF
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // formato que el navegador no decodifica: se sube tal cual y valida el servidor
  }
}
