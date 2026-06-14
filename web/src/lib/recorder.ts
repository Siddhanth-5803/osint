// Export the canvas animation to a downloadable video using MediaRecorder.
// Records the live canvas stream for `seconds`, then triggers a download.

export function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "video/webm";
}

export async function recordCanvas(
  canvas: HTMLCanvasElement,
  seconds: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const stream = canvas.captureStream(30);
  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];

  return new Promise((resolve, reject) => {
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onerror = (e) => reject(e);
    rec.onstop = () => resolve(new Blob(chunks, { type: mimeType }));

    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / (seconds * 1000));
      onProgress?.(p);
      if (p >= 1) {
        rec.stop();
      } else {
        requestAnimationFrame(tick);
      }
    };
    rec.start(100);
    requestAnimationFrame(tick);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function extFor(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}
