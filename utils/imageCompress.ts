/**
 * Compress a base64 data-URL image down to a max dimension + JPEG quality
 * using an off-screen canvas. Web-only path; on native we just return the
 * original because expo-image-picker already produces compressed JPEG.
 *
 * Why: phone cameras produce 4–8 MB photos, which becomes ~6–11 MB base64.
 * Posting that to the backend takes >30 s and trips axios' default timeout,
 * causing the admin's "Save Category" call to fail with
 * "timeout of 30000ms exceeded".
 */
import { Platform } from 'react-native';

export async function compressBase64Image(
  dataUrl: string,
  maxDim: number = 1280,
  quality: number = 0.82,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  if (Platform.OS !== 'web') return dataUrl;

  return new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.fillStyle = '#ffffff'; // flatten transparent PNGs to white
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          // If compression actually made it bigger (rare), keep original
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}
