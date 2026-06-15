// Final pass: skin smoothing (bilateral) + soft glow (뽀샤시) + background removal.

export const SMOOTH_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_src;
uniform sampler2D u_mask;    // foreground probability (R channel), 0..1
uniform vec2 u_texel;        // 1/width, 1/height
uniform float u_strength;    // skin smoothing 0..1
uniform float u_glow;        // 뽀샤시 0..1
uniform vec2 u_faceCenter;
uniform float u_faceRadius;
uniform float u_hasFace;
uniform float u_lowPower;
uniform float u_useMask;     // 1.0 = remove background
uniform vec3 u_bgColor;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Edge-preserving smoothing: average neighbours whose color is close.
vec4 bilateral(vec2 uv, float radius) {
  vec4 center = texture(u_src, uv);
  float lc = luma(center.rgb);
  vec4 sum = center;
  float wsum = 1.0;
  const int N = 8;
  vec2 offsets[8] = vec2[8](
    vec2( 1.0,  0.0), vec2(-1.0,  0.0),
    vec2( 0.0,  1.0), vec2( 0.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0,  1.0),
    vec2( 1.0, -1.0), vec2(-1.0, -1.0)
  );
  for (int i = 0; i < N; i++) {
    vec4 s = texture(u_src, uv + offsets[i] * u_texel * radius);
    float ld = abs(luma(s.rgb) - lc);
    float w = exp(-ld * ld / 0.03);
    sum += s * w;
    wsum += w;
  }
  return sum / wsum;
}

// Wide soft blur for the glow bloom.
vec3 softBlur(vec2 uv, float radius) {
  vec3 sum = texture(u_src, uv).rgb;
  float wsum = 1.0;
  const int N = 8;
  vec2 offsets[8] = vec2[8](
    vec2( 1.0,  0.4), vec2(-1.0, -0.4),
    vec2( 0.4, -1.0), vec2(-0.4,  1.0),
    vec2( 1.0, -1.0), vec2(-1.0,  1.0),
    vec2( 0.7,  0.7), vec2(-0.7, -0.7)
  );
  for (int i = 0; i < N; i++) {
    sum += texture(u_src, uv + offsets[i] * u_texel * radius).rgb;
    wsum += 1.0;
  }
  return sum / wsum;
}

void main() {
  vec3 color = texture(u_src, v_uv).rgb;

  // --- Skin smoothing (face region only) ---
  if (u_hasFace > 0.5 && u_strength > 0.001) {
    float d = distance(v_uv, u_faceCenter);
    float mask = 1.0 - smoothstep(u_faceRadius * 0.7, u_faceRadius * 1.1, d);
    if (mask > 0.0) {
      float radius = u_lowPower > 0.5 ? 2.0 : 3.0;
      vec3 sm = bilateral(v_uv, radius).rgb;
      if (u_strength > 0.5 && u_lowPower < 0.5) {
        sm = mix(sm, bilateral(v_uv, radius * 1.6).rgb, 0.5);
      }
      color = mix(color, sm, u_strength * mask);
    }
  }

  // --- 뽀샤시 (soft glow): bloom + brighten + soften contrast ---
  if (u_glow > 0.001) {
    float r = u_lowPower > 0.5 ? 5.0 : 8.0;
    vec3 bloom = softBlur(v_uv, r);
    // Screen blend so highlights bloom softly
    vec3 screened = 1.0 - (1.0 - color) * (1.0 - bloom * 0.85);
    vec3 glowed = mix(color, screened, 0.6);
    // Lift shadows + gentle brighten for the dreamy look
    glowed = glowed * 1.04 + 0.035;
    // Slight desaturation toward soft pastel
    float g = luma(glowed);
    glowed = mix(glowed, vec3(g), 0.08);
    color = mix(color, glowed, u_glow);
  }

  // --- Background removal ---
  if (u_useMask > 0.5) {
    float person = texture(u_mask, v_uv).r;
    float a = smoothstep(0.35, 0.65, person);
    color = mix(u_bgColor, color, a);
  }

  outColor = vec4(color, 1.0);
}
`;
