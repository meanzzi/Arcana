// 화면 전체를 덮는 사각형 하나. 픽셀마다 아래 조각 셰이더가 실행됨
const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_progress;
uniform float u_aspect;

const float EDGE = 0.08;
const vec3 GOLD = vec3(0.79, 0.64, 0.29);
const vec3 GOLD_LIGHT = vec3(1.0, 0.96, 0.84);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 크기가 다른 노이즈를 겹쳐서 불규칙한 불길 모양을 만듦
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  // 가로세로 비율을 맞춰야 노이즈 덩어리가 세로로 늘어나지 않음
  vec2 p = vec2(v_uv.x * u_aspect, v_uv.y) * 4.0;
  // 높이를 조금 섞어서 아래에서 위로 타 올라가게 함
  float n = fbm(p) * 0.75 + v_uv.y * 0.25;
  float threshold = u_progress * (1.0 + 2.0 * EDGE) - EDGE;
  float d = n - threshold;
  if (d < 0.0) discard;

  vec4 color = texture2D(u_image, v_uv);
  float edge = 1.0 - smoothstep(0.0, EDGE, d);
  float scorch = 1.0 - smoothstep(EDGE, EDGE * 2.5, d);
  vec3 rgb = mix(color.rgb, color.rgb * 0.35, scorch);
  rgb = mix(rgb, mix(GOLD, GOLD_LIGHT, edge * edge), edge);
  float alpha = color.a * smoothstep(0.0, 0.01, d);
  gl_FragColor = vec4(rgb * alpha, alpha);
}
`;

export type Dissolve = {
  draw: (progress: number) => void;
  dispose: () => void;
};

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// 카드 그림을 텍스처로 올려서, progress(0~1)에 따라 노이즈 모양으로 타서 사라지게 그림. WebGL을 못 쓰면 null
export function createDissolve(
  canvas: HTMLCanvasElement,
  image: TexImageSource,
): Dissolve | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true });
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 이미지는 위가 y=0, WebGL 텍스처는 아래가 y=0이라 뒤집어서 올림
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  // 크기가 2의 거듭제곱이 아닌 텍스처는 WebGL1에서 이 설정이어야 그려짐
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  const progressLocation = gl.getUniformLocation(program, "u_progress");
  gl.uniform1f(
    gl.getUniformLocation(program, "u_aspect"),
    canvas.width / canvas.height,
  );
  gl.viewport(0, 0, canvas.width, canvas.height);

  return {
    draw: (progress) => {
      gl.uniform1f(progressLocation, progress);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose: () => {
      if (gl.isContextLost()) return;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
