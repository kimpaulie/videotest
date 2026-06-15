// Fragment shader: face liquify warp.
// Bidirectional: positive strength slims/sharpens/enlarges, negative reverses.

export const WARP_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_video;

// Landmark uniforms in UV space (0..1, image top-left origin).
uniform vec2 u_faceCenter;   // centroid of the face
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

// Pull uv from 'center' toward 'target' within a circular radius.
vec2 liquify(vec2 uv, vec2 center, vec2 target, float radius, float strength) {
  float d = distance(uv, center);
  if (d >= radius) return uv;
  float ratio = pow(1.0 - d / radius, 2.0) * strength;
  return uv + (target - center) * ratio;
}

// Radial scale around a center (positive amount = shrink toward center).
vec2 radialShrink(vec2 uv, vec2 center, float radius, float amount) {
  float d = distance(uv, center);
  if (d >= radius) return uv;
  float falloff = pow(1.0 - d / radius, 1.5);
  float scale = 1.0 + amount * falloff;  // >1 samples farther = looks smaller
  return center + (uv - center) * scale;
}

// Enlarge around a center (positive amount = bigger).
vec2 radialGrow(vec2 uv, vec2 center, float radius, float amount) {
  float d = distance(uv, center);
  if (d >= radius) return uv;
  float falloff = pow(1.0 - d / radius, 2.0);
  return center + (uv - center) * (1.0 - amount * falloff);
}

void main() {
  vec2 uv = v_uv;

  if (u_hasFace > 0.5) {
    float fs = max(u_faceSize, 0.05);

    // 1) Overall face size — uniform radial scale around the centroid.
    //    Covers the whole head so the face shrinks/grows as a whole.
    uv = radialShrink(uv, u_faceCenter, fs * 0.85, u_slimFace * 0.22);

    // 2) Jaw / V-line — pull each jaw point toward the chin with a taper.
    //    Outer (gonial angle) moves most, inner (near chin) least, so the
    //    jaw curves smoothly into the chin instead of going flat.
    float r = fs * 0.34;
    uv = liquify(uv, u_jawL0, u_chinTip, r, u_vLine * 0.50);
    uv = liquify(uv, u_jawL1, u_chinTip, r, u_vLine * 0.36);
    uv = liquify(uv, u_jawL2, u_chinTip, r, u_vLine * 0.20);
    uv = liquify(uv, u_jawR0, u_chinTip, r, u_vLine * 0.50);
    uv = liquify(uv, u_jawR1, u_chinTip, r, u_vLine * 0.36);
    uv = liquify(uv, u_jawR2, u_chinTip, r, u_vLine * 0.20);

    // 3) Eye size — radial scale outward (enlarge) or inward (shrink)
    uv = radialGrow(uv, u_leftEye,  fs * 0.16, u_enlargeEyes * 0.35);
    uv = radialGrow(uv, u_rightEye, fs * 0.16, u_enlargeEyes * 0.35);
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
