/**
 * Utilitários para compressão e manipulação de imagens no editor.
 * Mantém imagens otimizadas em Base64 para garantir compatibilidade
 * com o limite de 1MB por documento do Firestore.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressImageFile(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<string> {
  const { maxWidth = 1400, maxHeight = 1400, quality = 0.8 } = options;

  // Se for SVG, não redimensiona no canvas para manter vetor puro
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular proporção mantendo aspecto
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback caso canvas 2d falhe
          resolve(readerEvent.target?.result as string);
          return;
        }

        // Suavização de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Tentar exportar em WebP, se suportado, senão JPEG
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {
          // Navegador sem suporte a WebP no canvas
        }

        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };

      img.onerror = (err) => {
        reject(err);
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export interface ExtractedImage {
  data: string;
  mimeType: string;
  alt?: string;
}

/**
 * Extrai imagens embutidas (Base64) presentes no HTML da nota.
 */
export function extractImagesFromHtml(html: string): ExtractedImage[] {
  if (!html) return [];
  const images: ExtractedImage[] = [];
  const imgRegex = /<img[^>]+src=["'](data:(image\/[^;]+);base64,([a-zA-Z0-9+/=\r\n]+))["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const mimeType = match[2];
    const data = match[3].replace(/[\r\n\s]/g, '');
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : undefined;

    images.push({ data, mimeType, alt });
  }

  return images;
}
