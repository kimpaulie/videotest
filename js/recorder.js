// Snapshot + MediaRecorder helpers.

export function downloadCanvasPNG(canvas, view = { mirror: true, rotation: 0 }, filename = `face-${Date.now()}.png`) {
  // Bake the preview's mirror + rotation into the saved image.
  const rot = ((view.rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const out = document.createElement('canvas');
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.scale(view.mirror ? -1 : 1, 1);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  out.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',
    'video/mp4'
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class CanvasRecorder {
  constructor(canvas, fps = 30) {
    this.canvas = canvas;
    this.fps = fps;
    this.recorder = null;
    this.chunks = [];
  }

  start() {
    const stream = this.canvas.captureStream(this.fps);
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
    this.mimeType = mimeType || 'video/webm';
  }

  stop() {
    return new Promise(resolve => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const ext = this.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `face-${Date.now()}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.recorder = null;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  isRecording() { return !!this.recorder && this.recorder.state === 'recording'; }
}
