export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Smartly compresses any image file using HTML5 Canvas.
 * Ensures the output base64 data URL remains well under Firestore's 1MB document limit
 * (typically 100KB - 400KB).
 */
export async function compressImageFile(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    maxSizeBytes?: number;
  } = {}
): Promise<{ dataUrl: string; sizeBytes: number; width: number; height: number }> {
  const { maxWidth = 1200, maxHeight = 1200, maxSizeBytes = 500 * 1024 } = options;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let width = img.width;
        let height = img.height;

        // Scale proportionally down to maxWidth / maxHeight
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
          throw new Error('Canvas context not available');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try standard quality
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // If still exceeds target max size, step down quality and dimensions
        if (dataUrl.length > maxSizeBytes && quality > 0.4) {
          quality = 0.6;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > maxSizeBytes && quality > 0.3) {
          quality = 0.45;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > maxSizeBytes) {
          // Downscale canvas to 800px max
          const scale = 800 / Math.max(width, height);
          const smallerCanvas = document.createElement('canvas');
          smallerCanvas.width = Math.round(width * scale);
          smallerCanvas.height = Math.round(height * scale);
          const sCtx = smallerCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
            dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.5);
          }
        }

        // Approximate binary size from base64 length
        const sizeBytes = Math.round((dataUrl.length * 3) / 4);

        resolve({
          dataUrl,
          sizeBytes,
          width,
          height,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}

/**
 * Validates and pre-processes files before sending to Firestore.
 * Enforces safety limits so document size stays well under the 1MB Firestore threshold.
 */
export async function processMediaFile(
  file: File,
  forcedType?: 'image' | 'video' | 'document'
): Promise<{
  dataUrl: string;
  type: 'image' | 'video' | 'document';
  fileName: string;
  fileSizeStr: string;
}> {
  const isImage = forcedType === 'image' || file.type.startsWith('image/');
  const isVideo = forcedType === 'video' || file.type.startsWith('video/');

  if (isImage) {
    const compressed = await compressImageFile(file, {
      maxWidth: 1280,
      maxHeight: 1280,
      maxSizeBytes: 500 * 1024, // 500 KB base64 payload target
    });

    const kb = Math.round(compressed.sizeBytes / 1024);
    return {
      dataUrl: compressed.dataUrl,
      type: 'image',
      fileName: file.name,
      fileSizeStr: kb > 0 ? `${kb} KB` : 'Image',
    };
  }

  if (isVideo) {
    // 700 KB limit for video clips inside Firestore documents
    const maxVideoBytes = 700 * 1024;
    if (file.size > maxVideoBytes) {
      throw new Error(
        `Video size (${Math.round(file.size / 1024)} KB) exceeds the 700 KB direct message limit. Please choose a shorter clip under 700 KB.`
      );
    }

    const dataUrl = await fileToBase64(file);
    return {
      dataUrl,
      type: 'video',
      fileName: file.name,
      fileSizeStr: `${Math.round(file.size / 1024)} KB`,
    };
  }

  // Document (PDF, doc, txt, zip)
  const maxDocBytes = 700 * 1024;
  if (file.size > maxDocBytes) {
    throw new Error(
      `File size (${Math.round(file.size / 1024)} KB) exceeds the 700 KB direct transfer limit. Please select a smaller document.`
    );
  }

  const dataUrl = await fileToBase64(file);
  return {
    dataUrl,
    type: 'document',
    fileName: file.name,
    fileSizeStr: `${Math.round(file.size / 1024)} KB`,
  };
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Prefer opus compression at 32 kbps to keep voice notes compact (< 250 KB)
    const options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options.mimeType = 'audio/webm;codecs=opus';
      options.audioBitsPerSecond = 32000;
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options.mimeType = 'audio/mp4';
      options.audioBitsPerSecond = 32000;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // collect every 250ms
  }

  stop(): Promise<{ blob: Blob; dataUrl: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder not initialized'));
      }

      const startTime = Date.now();

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          resolve({
            blob: audioBlob,
            dataUrl: reader.result as string,
            duration,
          });
        };

        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.audioChunks = [];
  }
}
