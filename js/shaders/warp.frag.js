// Fragment shader: face liquify warp.
// Uses 12 control points and pulls UV coordinates toward target points.

export const WARP_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_video;

// Landmark uniforms in UV space (0..1, with y already flipped to UV convention).
uniform vec2 u_faceTop;
uniform vec2 u_faceBottom;
uniform vec2 u_faceLeft;
uniform vec2 u_faceRight;
uniform vec2 u_jawLeft;
uniform vec2 u_jawRight;
uniform vec2 u_chinTip;
uniform vec2 u_leftEye;
uniform vec2 u_rightEye;
uniform vec2 u_leftEyeOuter;
uniform vec2 u_rightEyeOuter;
uniform vec2 u_noseTip;
uniform vec2 u_noseBridge;
uniform vec2 u_noseLeftWing;
uniform vec2 u_noseRightWing;
uniform vec2 u_lipCenter;
uniform vec2 u_lipLeft;
uniform vec2 u_lipRight;

uniform float u_faceWidth;   // face width in UV (for scaling radii)
uniform float u_hasFace;

uniform float u_slimFace;
uniform float u_vLine;
uniform float u_enlargeEyes;
uniform float u_slimNose;
uniform float u_noseHeight;
uniform float u_lipSize;

// Pull uv toward 'target' from 'center' within a circular radius.
// strength > 0 pulls toward target; < 0 pushes away (used for eye enlarge).
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

    // 1) Slim face: pull left/right cheeks toward center
    uv = liquify(uv, u_faceLeft,  faceCenter, fw * 0.55, u_slimFace * 0.35);
    uv = liquify(uv, u_faceRight, faceCenter, fw * 0.55, u_slimFace * 0.35);

    // 2) V-line: pull jaw points toward chin & center, shorten chin slightly
    vec2 jawTarget = mix(faceCenter, u_chinTip, 0.5);
    uv = liquify(uv, u_jawLeft,  jawTarget, fw * 0.45, u_vLine * 0.45);
    uv = liquify(uv, u_jawRight, jawTarget, fw * 0.45, u_vLine * 0.45);

    // 3) Eye enlarge — radial scale outward around each eye
    uv = radialScale(uv, u_leftEye,  fw * 0.18, u_enlargeEyes * 0.35);
    uv = radialScale(uv, u_rightEye, fw * 0.18, u_enlargeEyes * 0.35);

    // 4) Nose slim — pull both wings toward bridge
    uv = liquify(uv, u_noseLeftWing,  u_noseBridge, fw * 0.18, u_slimNose * 0.45);
    uv = liquify(uv, u_noseRightWing, u_noseBridge, fw * 0.18, u_slimNose * 0.45);

    // 5) Nose height — push tip up (toward bridge) or down
    vec2 noseTarget = u_noseTip + (u_noseBridge - u_noseTip) * u_noseHeight;
    uv = liquify(uv, u_noseTip, noseTarget, fw * 0.22, 0.6);

    // 6) Lip size — radial scale around lip center
    uv = radialScale(uv, u_lipCenter, fw * 0.22, u_lipSize * 0.25);
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
