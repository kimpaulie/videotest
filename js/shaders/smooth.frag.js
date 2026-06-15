// Bilateral-style skin smoothing fragment shader.
// Approximation: weighted 5x5 (or 9-tap cross) kernel where weight drops
// with color difference, so edges (eyes, brows, lips) stay sharp.

export const SMOOTH_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_src;
uniform vec2 u_texel;       // 1/width, 1/height
uniform float u_strength;   // 0..1
uniform vec2 u_faceCenter;
uniform float u_faceRadius;
uniform float u_hasFace;
uniform float u_lowPower;   // 1.0 = use smaller kernel

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec4 bilateral(vec2 uv, float radius) {
  vec4 center = texture(u_src, uv);
  float lc = luma(center.rgb);
  vec4 sum = center;
  float wsum = 1.0;
  // Sample on a ring + cross. Cheap and effective.
  const int N = 8;
  vec2 offsets[8] = vec2[8](
    vec2( 1.0,  0.0), vec2(-1.0,  0.0),
    vec2( 0.0,  1.0), vec2( 0.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0,  1.0),
    vec2( 1.0, -1.0), vec2(-1.0, -1.0)
  );
  for (int i = 0; i < N; i++) {
    vec2 o = offsets[i] * u_texel * radius;
    vec4 s = texture(u_src, uv + o);
    float ld = abs(luma(s.rgb) - lc);
    // Color similarity weight (sigma ~ 0.12). Edges get small weight.
    float w = exp(-ld * ld / 0.03);
    sum += s * w;
    wsum += w;
  }
  return sum / wsum;
}

void main() {
  vec4 src = texture(u_src, v_uv);
  if (u_hasFace < 0.5 || u_strength <= 0.001) {
    outColor = src;
    return;
  }
  // Soft face mask: full inside radius, fade out.
  float d = distance(v_uv, u_faceCenter);
  float mask = 1.0 - smoothstep(u_faceRadius * 0.7, u_faceRadius * 1.1, d);
  if (mask <= 0.0) { outColor = src; return; }

  float radius = u_lowPower > 0.5 ? 2.0 : 3.0;
  // Two passes for stronger effect at high strength
  vec4 smoothed = bilateral(v_uv, radius);
  if (u_strength > 0.5 && u_lowPower < 0.5) {
    smoothed = mix(smoothed, bilateral(v_uv, radius * 1.6), 0.5);
  }
  float amount = u_strength * mask;
  outColor = mix(src, smoothed, amount);
}
`;
