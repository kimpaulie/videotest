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
// 468-point topology. Each entry maps to a uniform slot in the shader.
export const LANDMARK_INDEX = {
  faceTop: 10,
  faceBottom: 152,
  faceLeft: 234,
  faceRight: 454,
  jawLeft: 172,
  jawRight: 397,
  chinTip: 152,
  // Eye centers (averages computed at runtime from these pairs)
  leftEyeInner: 133,
  leftEyeOuter: 33,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  noseTip: 1,
  noseBridge: 6,
  noseLeftWing: 98,
  noseRightWing: 327,
  upperLip: 13,
  lowerLip: 14,
  lipLeft: 78,
  lipRight: 308
};
