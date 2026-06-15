// Fragment shader: face liquify warp.
// Bidirectional: positive strength slims/sharpens/enlarges, negative reverses.
// Effect strengths are intentionally gentle — sliders saturate to a subtle max.

export const WARP_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_video;

// Head/face geometry in UV space (0..1, image top-left origin).
uniform vec2 u_headCenter;   // center of the whole head (biased up toward crown)
uniform float u_headInner;   // plateau radius (uniform scaling inside this)
uniform float u_headOuter;   // transition radius (scaling fades to 0 by here)

uniform vec2 u_chinTip;
uniform vec2 u_leftEye;
uniform vec2 u_rightEye;
// Jaw silhouette: 3 points per side, outer (gonial angle) -> inner (near chin)
uniform vec2 u_jawL0; uniform vec2 u_jawL1; uniform vec2 u_jawL2;
uniform vec2 u_jawR0; uniform vec2 u_jawR1; uniform vec2 u_jawR2;

uniform float u_faceSize;    // max(width,height) of the face in UV

uniform float u_hasFace;
uniform float u_slimFace;     // -1..1
uniform float u_vLine;        // -1..1
uniform float u_enlargeEyes;  // -1..1

// Uniform resize of a region with a soft edge.
// 'amount' > 0 shrinks (samples outward), < 0 enlarges. The interior between
// the center and innerR scales by a CONSTANT factor (true resize, no pinch);
// only the innerR..outerR band ramps the factor back to 1 so the background
// isn't distorted and there's no hard seam.
vec2 regionScale(vec2 uv, vec2 center, float innerR, float outerR, float amount) {
  float d = distance(uv, center);
  float m = 1.0 - smoothstep(innerR, outerR, d);   // 1 inside plateau, 0 outside
  float scale = 1.0 + amount * m;
  return center + (uv - center) * scale;
}

// Smooth (C1) pull of uv from 'center' toward 'target' within a radius.
vec2 liquify(vec2 uv, vec2 center, vec2 target, float radius, float strength) {
  float d = distance(uv, center);
  if (d >= radius) return uv;
  float f = 1.0 - d / radius;
  float ratio = (f * f * (3.0 - 2.0 * f)) * strength;  // smoothstep falloff
  return uv + (target - center) * ratio;
}

void main() {
  vec2 uv = v_uv;

  if (u_hasFace > 0.5) {
    float fs = max(u_faceSize, 0.05);

    // 1) Whole-head size — uniform scale around the head center with a soft
    //    edge, so the entire head (incl. hair) grows/shrinks together.
    uv = regionScale(uv, u_headCenter, u_headInner, u_headOuter, u_slimFace * 0.12);

    // 2) Jaw / V-line — overlapping soft pulls toward the chin, graduated so the
    //    jaw curves smoothly into the chin (dimensional, not a flat squeeze).
    float r = fs * 0.42;
    uv = liquify(uv, u_jawL0, u_chinTip, r, u_vLine * 0.26);
    uv = liquify(uv, u_jawL1, u_chinTip, r, u_vLine * 0.18);
    uv = liquify(uv, u_jawL2, u_chinTip, r, u_vLine * 0.10);
    uv = liquify(uv, u_jawR0, u_chinTip, r, u_vLine * 0.26);
    uv = liquify(uv, u_jawR1, u_chinTip, r, u_vLine * 0.18);
    uv = liquify(uv, u_jawR2, u_chinTip, r, u_vLine * 0.10);

    // 3) Eye size — gentle uniform scale around each eye.
    uv = regionScale(uv, u_leftEye,  fs * 0.10, fs * 0.20, -u_enlargeEyes * 0.18);
    uv = regionScale(uv, u_rightEye, fs * 0.10, fs * 0.20, -u_enlargeEyes * 0.18);
  }

  outColor = texture(u_video, uv);
}
`;

export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
