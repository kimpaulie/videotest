// Fragment shader: face liquify warp.
// Bidirectional: positive strength slims/sharpens/enlarges, negative reverses.

export const WARP_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_video;

// Landmark uniforms in UV space (0..1, image top-left origin).
uniform vec2 u_faceLeft;
uniform vec2 u_faceRight;
uniform vec2 u_jawLeft;
uniform vec2 u_jawRight;
uniform vec2 u_chinTip;
uniform vec2 u_leftEye;
uniform vec2 u_rightEye;

uniform float u_faceWidth;
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

// Radial scale around a center (positive = enlarge).
vec2 radialScale(vec2 uv, vec2 center, float radius, float amount) {
  float d = distance(uv, center);
  if (d >= radius) return uv;
  float falloff = pow(1.0 - d / radius, 2.0);
  float scale = 1.0 - amount * falloff;
  return center + (uv - center) * scale;
}

void main() {
  vec2 uv = v_uv;

  if (u_hasFace > 0.5) {
    vec2 faceCenter = (u_faceLeft + u_faceRight) * 0.5;
    float fw = max(u_faceWidth, 0.05);

    // Face size: pull cheeks toward center (slim) or push out (widen)
    uv = liquify(uv, u_faceLeft,  faceCenter, fw * 0.55, u_slimFace * 0.32);
    uv = liquify(uv, u_faceRight, faceCenter, fw * 0.55, u_slimFace * 0.32);

    // Jaw line: pull jaw toward chin/center (sharpen) or out (round)
    vec2 jawTarget = mix(faceCenter, u_chinTip, 0.5);
    uv = liquify(uv, u_jawLeft,  jawTarget, fw * 0.45, u_vLine * 0.42);
    uv = liquify(uv, u_jawRight, jawTarget, fw * 0.45, u_vLine * 0.42);

    // Eye size: radial scale outward (enlarge) or inward (shrink)
    uv = radialScale(uv, u_leftEye,  fw * 0.18, u_enlargeEyes * 0.35);
    uv = radialScale(uv, u_rightEye, fw * 0.18, u_enlargeEyes * 0.35);
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
