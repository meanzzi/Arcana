import { between, createRandom, gaussianRandom } from "../../utils/random";

const AREA_PER_PARTICLE = 35;
const MIN_PARTICLES = 8000;
const MAX_PARTICLES = 15000;

const SMALL_SIZE_MIN = 0.3;
const SMALL_SIZE_MAX = 1.2;
const LARGE_RATIO = 0.04;
const LARGE_SIZE_MIN = 1.5;
const LARGE_SIZE_MAX = 2.5;
const LARGE_ALPHA_MIN = 0.85;
const LARGE_ALPHA_MAX = 1;
const LARGE_COLOR = "#F3DFA2";

const ALPHA_MIN = 0.5;
const ALPHA_MAX = 1;

const DUST_COLORS = ["#E8C77A", "#D4A84B", "#F3DFA2"];

const FLOW_SIGMA_RATIO = 0.08;
const MAX_SIGMA = 3;

const GLOW_SCALE = 5;
const GLOW_ALPHA = 0.35;

const BAND_ALPHA = 0.08;
const BAND_RADIUS = 2.8;
const BAND_COLOR = "232, 199, 122";

const FLOW_PATH: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.55, y: -0.05 },
  { x: 0.8, y: 0.2 },
  { x: 0.88, y: 0.42 },
  { x: 0.7, y: 0.6 },
  { x: 0.4, y: 0.66 },
  { x: 0.15, y: 0.72 },
  { x: 0.12, y: 0.88 },
  { x: 0.35, y: 1.05 },
];

const WAVE_AMP = 0.012;
const WAVE_COUNT = 1.5;
const WAVE_PERIOD = 9;
const SWELL_AMP = 0.08;
const SWELL_PERIOD = 13;

const TWINKLE_MIN = 0.35;
const TWINKLE_PERIOD_MIN = 2.5;
const TWINKLE_PERIOD_MAX = 5;

const DEBUG_PATH = false;

type Point = { x: number; y: number };

type Segment = [Point, Point, Point, Point];

type DustParticle = {
  t: number;
  z: number;
  size: number;
  alpha: number;
  color: string;
  large: boolean;
};

export type RibbonMotion = { flow: number; time: number };

export type RibbonLayout = {
  originX: number;
  boxWidth: number;
  height: number;
  segmentEnds: number[];
};

function buildPath(points: ReadonlyArray<Point>): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    segments.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ]);
  }
  return segments;
}

const PATH: Segment[] = buildPath(FLOW_PATH);
const BOX_ASPECT = 0.7;

function segmentLength(
  segment: Segment,
  boxWidth: number,
  height: number,
): number {
  const steps = 24;
  let length = 0;
  let prev = bezierPoint(segment, 0);
  for (let i = 1; i <= steps; i += 1) {
    const next = bezierPoint(segment, i / steps);
    length += Math.hypot(
      (next.x - prev.x) * boxWidth,
      (next.y - prev.y) * height,
    );
    prev = next;
  }
  return length;
}

export function getLayout(width: number, height: number): RibbonLayout {
  const boxWidth = Math.min(width, height * BOX_ASPECT);

  const lengths = PATH.map((segment) =>
    segmentLength(segment, boxWidth, height),
  );
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let accumulated = 0;
  const segmentEnds = lengths.map((value) => {
    accumulated += value;
    return accumulated / total;
  });

  return { originX: (width - boxWidth) / 2, boxWidth, height, segmentEnds };
}

export function getParticleCount(layout: RibbonLayout): number {
  const count = Math.round(
    (layout.boxWidth * layout.height) / AREA_PER_PARTICLE,
  );
  return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, count));
}

function bezierPoint([a, b, c, d]: Segment, u: number): Point {
  const m = 1 - u;
  return {
    x:
      m * m * m * a.x +
      3 * m * m * u * b.x +
      3 * m * u * u * c.x +
      u * u * u * d.x,
    y:
      m * m * m * a.y +
      3 * m * m * u * b.y +
      3 * m * u * u * c.y +
      u * u * u * d.y,
  };
}

function bezierTangent([a, b, c, d]: Segment, u: number): Point {
  const m = 1 - u;
  return {
    x:
      3 * m * m * (b.x - a.x) +
      6 * m * u * (c.x - b.x) +
      3 * u * u * (d.x - c.x),
    y:
      3 * m * m * (b.y - a.y) +
      6 * m * u * (c.y - b.y) +
      3 * u * u * (d.y - c.y),
  };
}

function samplePath(
  t: number,
  layout: RibbonLayout,
): { point: Point; normal: Point } {
  let index = 0;
  while (index < PATH.length - 1 && t > layout.segmentEnds[index]) {
    index += 1;
  }
  const start = index === 0 ? 0 : layout.segmentEnds[index - 1];
  const end = layout.segmentEnds[index];
  const u = Math.min(1, Math.max(0, (t - start) / (end - start || 1)));
  const segment = PATH[index];

  const p = bezierPoint(segment, u);
  const tangent = bezierTangent(segment, u);

  const tx = tangent.x * layout.boxWidth;
  const ty = tangent.y * layout.height;
  const length = Math.hypot(tx, ty) || 1;

  return {
    point: {
      x: layout.originX + p.x * layout.boxWidth,
      y: p.y * layout.height,
    },
    normal: { x: -ty / length, y: tx / length },
  };
}

function flowSigma(t: number, layout: RibbonLayout): number {
  const taper = 0.45 + 0.55 * Math.sin(Math.PI * t);
  const ripple = 1 + 0.12 * Math.sin(t * Math.PI * 5);
  return layout.boxWidth * FLOW_SIGMA_RATIO * taper * ripple;
}

function endFade(t: number): number {
  return Math.min(1, t / 0.1, (1 - t) / 0.1);
}

function createParticle(random: () => number): DustParticle {
  let z = gaussianRandom(random);
  while (Math.abs(z) > MAX_SIGMA) {
    z = gaussianRandom(random);
  }

  const t = random();
  if (random() < LARGE_RATIO) {
    return {
      t,
      z,
      size: between(random, LARGE_SIZE_MIN, LARGE_SIZE_MAX),
      alpha: between(random, LARGE_ALPHA_MIN, LARGE_ALPHA_MAX),
      color: LARGE_COLOR,
      large: true,
    };
  }

  return {
    t,
    z,
    size: between(random, SMALL_SIZE_MIN, SMALL_SIZE_MAX),
    alpha: between(random, ALPHA_MIN, ALPHA_MAX),
    color: DUST_COLORS[Math.floor(random() * DUST_COLORS.length)],
    large: false,
  };
}

export function createParticles(seed: number): DustParticle[] {
  const random = createRandom(seed);
  const particles: DustParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push(createParticle(random));
  }
  return particles;
}

export function createGlowSprite(): HTMLCanvasElement {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;

  const ctx = sprite.getContext("2d");
  if (!ctx) {
    return sprite;
  }

  const center = size / 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );
  gradient.addColorStop(0, "rgba(243, 223, 162, 1)");
  gradient.addColorStop(0.3, "rgba(232, 199, 122, 0.5)");
  gradient.addColorStop(1, "rgba(232, 199, 122, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return sprite;
}

const BAND_STEPS = 160;

export function createGlowBand(
  layout: RibbonLayout,
  dpr: number,
): HTMLCanvasElement {
  const width = layout.originX * 2 + layout.boxWidth;
  const band = document.createElement("canvas");
  band.width = Math.round(width * dpr);
  band.height = Math.round(layout.height * dpr);

  const ctx = band.getContext("2d");
  if (!ctx) {
    return band;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  for (let i = 0; i < BAND_STEPS; i += 1) {
    const t = i / (BAND_STEPS - 1);
    const { point } = samplePath(t, layout);
    const radius = flowSigma(t, layout) * BAND_RADIUS;

    const gradient = ctx.createRadialGradient(
      point.x,
      point.y,
      0,
      point.x,
      point.y,
      radius,
    );
    gradient.addColorStop(0, `rgba(${BAND_COLOR}, 1)`);
    gradient.addColorStop(0.5, `rgba(${BAND_COLOR}, 0.4)`);
    gradient.addColorStop(1, `rgba(${BAND_COLOR}, 0)`);

    ctx.globalAlpha = 0.2 * endFade(t);
    ctx.fillStyle = gradient;
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }

  return band;
}

function twinkle(index: number, time: number): number {
  const spread = (index * 0.618034) % 1;
  const period =
    TWINKLE_PERIOD_MIN + spread * (TWINKLE_PERIOD_MAX - TWINKLE_PERIOD_MIN);
  const wave =
    0.5 + 0.5 * Math.sin((time / period) * Math.PI * 2 + index * 2.399963);
  return TWINKLE_MIN + (1 - TWINKLE_MIN) * wave;
}

export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  layout: RibbonLayout,
  particles: DustParticle[],
  count: number,
  glow: HTMLCanvasElement,
  glowBand: HTMLCanvasElement,
  motion: RibbonMotion = { flow: 0, time: 0 },
): void {
  const width = layout.originX * 2 + layout.boxWidth;
  ctx.clearRect(0, 0, width, layout.height);
  ctx.globalAlpha = BAND_ALPHA;
  ctx.drawImage(glowBand, 0, 0, width, layout.height);

  const drawCount = Math.min(count, particles.length);
  for (let i = 0; i < drawCount; i += 1) {
    const particle = particles[i];
    const t = (particle.t + motion.flow) % 1;
    const edgeFade = 1 - (Math.abs(particle.z) / MAX_SIGMA) * 0.6;
    let alpha = particle.alpha * endFade(t) * edgeFade;
    if (alpha <= 0.01) {
      continue;
    }

    const { point, normal } = samplePath(t, layout);
    const wave = Math.sin(
      t * Math.PI * 2 * WAVE_COUNT - (motion.time / WAVE_PERIOD) * Math.PI * 2,
    );
    const swell =
      1 +
      SWELL_AMP *
        Math.sin(t * Math.PI * 3 + (motion.time / SWELL_PERIOD) * Math.PI * 2);
    const distance =
      particle.z * flowSigma(t, layout) * swell +
      wave * WAVE_AMP * layout.boxWidth;
    const x = point.x + normal.x * distance;
    const y = point.y + normal.y * distance;

    if (particle.large) {
      alpha *= twinkle(i, motion.time);
      const glowSize = particle.size * GLOW_SCALE;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * GLOW_ALPHA;
      ctx.drawImage(
        glow,
        x - glowSize / 2,
        y - glowSize / 2,
        glowSize,
        glowSize,
      );
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.size < 1.2) {
      ctx.fillRect(
        x - particle.size / 2,
        y - particle.size / 2,
        particle.size,
        particle.size,
      );
    } else {
      ctx.beginPath();
      ctx.arc(x, y, particle.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (DEBUG_PATH) {
    drawDebugPath(ctx, layout);
  }
}

function drawDebugPath(
  ctx: CanvasRenderingContext2D,
  layout: RibbonLayout,
): void {
  const steps = 300;
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const { point } = samplePath(i / steps, layout);
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();

  ctx.fillStyle = "#ff3b3b";
  for (const p of FLOW_PATH) {
    ctx.beginPath();
    ctx.arc(
      layout.originX + p.x * layout.boxWidth,
      p.y * layout.height,
      3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
