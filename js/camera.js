// Webcam capture. Front camera by default; supports flipping.

let currentFacing = 'user';
let activeStream = null;

export async function startCamera(videoEl, { facingMode = 'user', width = 1280, height = 720 } = {}) {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  currentFacing = facingMode;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: width },
      height: { ideal: height }
    },
    audio: false
  });
  activeStream = stream;
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', '');
  videoEl.muted = true;
  await videoEl.play();
  // Wait until metadata loaded (videoWidth available).
  if (!videoEl.videoWidth) {
    await new Promise(res => videoEl.addEventListener('loadedmetadata', res, { once: true }));
  }
  return stream;
}

export async function flipCamera(videoEl) {
  const next = currentFacing === 'user' ? 'environment' : 'user';
  try {
    return await startCamera(videoEl, { facingMode: next });
  } catch (e) {
    // Fall back to previous camera if flip fails.
    return await startCamera(videoEl, { facingMode: currentFacing });
  }
}

export function getFacing() { return currentFacing; }
