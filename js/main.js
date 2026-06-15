// Main orchestrator: wires camera → detector → renderer → UI.

import { startCamera, flipCamera } from './camera.js';
import { initDetector, detect } from './face-detector.js';
import { Renderer } from './renderer.js';
import { downloadCanvasPNG, CanvasRecorder } from './recorder.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');

const sliderIds = ['slimFace', 'vLine', 'enlargeEyes', 'slimNose', 'noseHeight', 'lipSize', 'smooth'];
const sliders = Object.fromEntries(sliderIds.map(id => [id, document.getElementById(id)]));
const autoOpt = document.getElementById('autoOptimize');

function readParams() {
  const p = {};
  for (const id of sliderIds) p[id] = parseFloat(sliders[id].value);
  return p;
}

function updateOutputs() {
  for (const id of sliderIds) {
    const out = sliders[id].nextElementSibling;
    if (out && out.tagName === 'OUTPUT') out.value = parseFloat(sliders[id].value).toFixed(2);
  }
}

function setStatus(msg, isError = false) {
  if (!msg) { statusEl.classList.add('hidden'); return; }
  statusEl.classList.remove('hidden');
  statusEl.classList.toggle('error', isError);
  statusEl.textContent = msg;
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
         (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
}

async function loadPresets() {
  try {
    const res = await fetch('assets/presets.json');
    return await res.json();
  } catch { return null; }
}

let renderer;
let recorder;
let presets;
let detectorReady = false;

// View orientation (preview + PNG export). Recording captures base canvas.
const view = { mirror: true, rotation: 0 }; // rotation in degrees: 0/90/180/270

function applyViewTransform() {
  const sx = view.mirror ? -1 : 1;
  canvas.style.transform = `rotate(${view.rotation}deg) scaleX(${sx})`;
}
let frameCounter = 0;
let cachedLandmarks = null;
let lastFrameTime = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;

async function boot() {
  try {
    setStatus('웹캠 권한 요청 중…');
    await startCamera(video, { facingMode: 'user' });
    setStatus('얼굴 인식 모델 로딩 중…');
  } catch (e) {
    setStatus('웹캠을 사용할 수 없습니다: ' + e.message, true);
    return;
  }

  renderer = new Renderer(canvas);
  recorder = new CanvasRecorder(canvas, 30);
  presets = await loadPresets();

  try {
    await initDetector();
    detectorReady = true;
  } catch (e) {
    setStatus('얼굴 인식 모델 로드 실패: ' + e.message, true);
    // Continue without face detection — sliders won't do anything but preview works.
  }

  setStatus(null);
  wireUI();
  requestAnimationFrame(loop);
}

function loop(now) {
  // FPS measurement
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 500) {
    const fps = (fpsFrames / fpsAccum) * 1000;
    fpsEl.textContent = fps.toFixed(0) + ' fps';
    fpsAccum = 0; fpsFrames = 0;
  }

  if (detectorReady && video.readyState >= 2) {
    // On low-power devices, detect every other frame and reuse landmarks.
    const lowPower = autoOpt.checked && isMobile();
    const shouldDetect = !lowPower || (frameCounter % 2 === 0);
    if (shouldDetect) {
      try {
        cachedLandmarks = detect(video, now);
      } catch (e) {
        // Some browsers throw if timestamp doesn't advance monotonically.
      }
    }
    renderer.updateLandmarks(cachedLandmarks);
    renderer.updateParams({ ...readParams(), lowPower });
  } else {
    renderer.updateLandmarks(null);
    renderer.updateParams({ ...readParams(), lowPower: false });
  }

  renderer.draw(video);
  frameCounter++;
  requestAnimationFrame(loop);
}

function wireUI() {
  for (const id of sliderIds) {
    sliders[id].addEventListener('input', updateOutputs);
  }
  updateOutputs();

  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      if (!presets || !presets[key]) return;
      const p = presets[key];
      for (const id of sliderIds) {
        if (id in p) sliders[id].value = p[id];
      }
      updateOutputs();
      document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // View controls
  applyViewTransform();
  const mirrorBtn = document.getElementById('mirror');
  mirrorBtn.addEventListener('click', () => {
    view.mirror = !view.mirror;
    mirrorBtn.classList.toggle('active', view.mirror);
    applyViewTransform();
  });
  document.getElementById('rotate').addEventListener('click', () => {
    view.rotation = (view.rotation + 90) % 360;
    applyViewTransform();
  });

  document.getElementById('snap').addEventListener('click', () => {
    downloadCanvasPNG(canvas, view);
  });

  const recBtn = document.getElementById('record');
  recBtn.addEventListener('click', async () => {
    if (recorder.isRecording()) {
      recBtn.disabled = true;
      await recorder.stop();
      recBtn.classList.remove('recording');
      recBtn.textContent = '⏺ 녹화 시작';
      recBtn.disabled = false;
    } else {
      recorder.start();
      recBtn.classList.add('recording');
      recBtn.textContent = '⏹ 녹화 종료';
    }
  });

  document.getElementById('flip').addEventListener('click', async () => {
    setStatus('카메라 전환 중…');
    try {
      await flipCamera(video);
      setStatus(null);
    } catch (e) {
      setStatus('카메라 전환 실패: ' + e.message, true);
    }
  });
}

// Pause loop when the page is hidden to save battery.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (recorder && recorder.isRecording()) recorder.stop();
  }
});

boot();
