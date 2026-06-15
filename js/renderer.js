// WebGL2 renderer. Two-pass pipeline:
//   pass 1 (warp):   video texture -> FBO
//   pass 2 (smooth): FBO texture   -> canvas
// Uses normalized 0..1 UV with y already in image-space (top-left origin),
// which the vertex shader handles via the y-flip.

import { VERTEX_SHADER, WARP_FRAGMENT } from './shaders/warp.frag.js';
import { SMOOTH_FRAGMENT } from './shaders/smooth.frag.js';
import { LANDMARK_INDEX } from './face-detector.js';

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error:\n' + log + '\n---\n' + src);
  }
  return sh;
}

function link(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.warpProg = link(gl, VERTEX_SHADER, WARP_FRAGMENT);
    this.smoothProg = link(gl, VERTEX_SHADER, SMOOTH_FRAGMENT);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);
    this.quad = buf;

    // Setup VAO per program
    this.warpVao = this._makeVao(this.warpProg);
    this.smoothVao = this._makeVao(this.smoothProg);

    // Video texture
    this.videoTex = this._createTexture();
    // Intermediate FBO + texture
    this.fboTex = this._createTexture();
    this.fbo = gl.createFramebuffer();

    this.width = 0;
    this.height = 0;

    this.params = {
      slimFace: 0.3, vLine: 0.3, enlargeEyes: 0.2,
      slimNose: 0.2, noseHeight: 0, lipSize: 0,
      smooth: 0.4, lowPower: false
    };
    this.landmarks = null;
  }

  _makeVao(prog) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  _createTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  resize(w, h) {
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  updateParams(p) { Object.assign(this.params, p); }
  updateLandmarks(landmarks) { this.landmarks = landmarks; }

  draw(video) {
    const gl = this.gl;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    this.resize(w, h);

    // Upload video to texture
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // -------- Pass 1: warp to FBO --------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.warpProg);
    gl.bindVertexArray(this.warpVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
    gl.uniform1i(gl.getUniformLocation(this.warpProg, 'u_video'), 0);

    const lm = this.landmarks;
    const hasFace = lm ? 1.0 : 0.0;
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_hasFace'), hasFace);

    const setUV = (name, idx) => {
      const p = lm ? lm[idx] : { x: 0.5, y: 0.5 };
      gl.uniform2f(gl.getUniformLocation(this.warpProg, name), p.x, p.y);
    };
    const setAvgUV = (name, a, b) => {
      if (lm) {
        const pa = lm[a], pb = lm[b];
        gl.uniform2f(gl.getUniformLocation(this.warpProg, name), (pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
      } else {
        gl.uniform2f(gl.getUniformLocation(this.warpProg, name), 0.5, 0.5);
      }
    };

    setUV('u_faceTop',     LANDMARK_INDEX.faceTop);
    setUV('u_faceBottom',  LANDMARK_INDEX.faceBottom);
    setUV('u_faceLeft',    LANDMARK_INDEX.faceLeft);
    setUV('u_faceRight',   LANDMARK_INDEX.faceRight);
    setUV('u_jawLeft',     LANDMARK_INDEX.jawLeft);
    setUV('u_jawRight',    LANDMARK_INDEX.jawRight);
    setUV('u_chinTip',     LANDMARK_INDEX.chinTip);
    setAvgUV('u_leftEye',  LANDMARK_INDEX.leftEyeInner, LANDMARK_INDEX.leftEyeOuter);
    setAvgUV('u_rightEye', LANDMARK_INDEX.rightEyeInner, LANDMARK_INDEX.rightEyeOuter);
    setUV('u_leftEyeOuter',  LANDMARK_INDEX.leftEyeOuter);
    setUV('u_rightEyeOuter', LANDMARK_INDEX.rightEyeOuter);
    setUV('u_noseTip',       LANDMARK_INDEX.noseTip);
    setUV('u_noseBridge',    LANDMARK_INDEX.noseBridge);
    setUV('u_noseLeftWing',  LANDMARK_INDEX.noseLeftWing);
    setUV('u_noseRightWing', LANDMARK_INDEX.noseRightWing);
    setAvgUV('u_lipCenter',  LANDMARK_INDEX.upperLip, LANDMARK_INDEX.lowerLip);
    setUV('u_lipLeft',       LANDMARK_INDEX.lipLeft);
    setUV('u_lipRight',      LANDMARK_INDEX.lipRight);

    let fw = 0.3;
    if (lm) {
      const L = lm[LANDMARK_INDEX.faceLeft];
      const R = lm[LANDMARK_INDEX.faceRight];
      fw = Math.hypot(R.x - L.x, R.y - L.y);
    }
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_faceWidth'), fw);

    const p = this.params;
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_slimFace'),    p.slimFace);
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_vLine'),       p.vLine);
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_enlargeEyes'), p.enlargeEyes);
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_slimNose'),    p.slimNose);
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_noseHeight'),  p.noseHeight);
    gl.uniform1f(gl.getUniformLocation(this.warpProg, 'u_lipSize'),     p.lipSize);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // -------- Pass 2: smooth to canvas --------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.smoothProg);
    gl.bindVertexArray(this.smoothVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(gl.getUniformLocation(this.smoothProg, 'u_src'), 0);
    gl.uniform2f(gl.getUniformLocation(this.smoothProg, 'u_texel'), 1 / w, 1 / h);
    gl.uniform1f(gl.getUniformLocation(this.smoothProg, 'u_strength'), p.smooth);
    gl.uniform1f(gl.getUniformLocation(this.smoothProg, 'u_lowPower'), p.lowPower ? 1.0 : 0.0);
    gl.uniform1f(gl.getUniformLocation(this.smoothProg, 'u_hasFace'), hasFace);

    if (lm) {
      const c = lm[LANDMARK_INDEX.noseTip];
      gl.uniform2f(gl.getUniformLocation(this.smoothProg, 'u_faceCenter'), c.x, c.y);
    } else {
      gl.uniform2f(gl.getUniformLocation(this.smoothProg, 'u_faceCenter'), 0.5, 0.5);
    }
    gl.uniform1f(gl.getUniformLocation(this.smoothProg, 'u_faceRadius'), fw * 0.9);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
