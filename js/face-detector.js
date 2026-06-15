// MediaPipe FaceLandmarker wrapper. Loads from CDN and exposes detectForVideo().

import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs';

let landmarker = null;

export async function initDetector() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
  );
  landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
  return landmarker;
}

export function detect(video, timestamp) {
  if (!landmarker) return null;
  const result = landmarker.detectForVideo(video, timestamp);
  if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) return null;
  return result.faceLandmarks[0]; // array of {x,y,z}, normalized 0..1
}

// Indices used by the warp shader. Coordinates are MediaPipe FaceLandmarker
// 468-point topology.
export const LANDMARK_INDEX = {
  faceTop: 10,
  faceBottom: 152,
  faceLeft: 234,
  faceRight: 454,
  chinTip: 152,
  // Jaw silhouette, outer (gonial angle) -> inner (near chin)
  jawL0: 172, jawL1: 150, jawL2: 176,
  jawR0: 397, jawR1: 379, jawR2: 400,
  // Eye centers (averages computed at runtime from these pairs)
  leftEyeInner: 133,
  leftEyeOuter: 33,
  rightEyeInner: 362,
  rightEyeOuter: 263
};
