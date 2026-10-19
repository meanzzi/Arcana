/*
  S자 금가루 띠의 입자 생성·그리기 로직.
  React 컴포넌트(GoldDustRibbon.tsx)와 분리해 두어, 애니메이션 단계에서
  프레임마다 drawRibbon만 다시 호출하는 식으로 그대로 재사용할 수 있게 함.

  구성
  - 입자만으로 흐름의 형태를 만든다 (뿌연 안개·블러 레이어는 쓰지 않음 → 회색·보라 번짐 방지)
  - 입자: S자 곡선 위 한 점에서 '수직 방향'으로 가우시안 분포로 흩뿌림
    → 중심은 거의 붙어 보일 만큼 촘촘하고 바깥으로 갈수록 성기게, 가장자리는 부드럽게 사라짐
    (평행한 가닥 여러 개로 그리면 빛줄기처럼 보여서 사용하지 않음)
*/

import { between, createRandom, gaussianRandom } from "../../utils/random";

/* ================= 튜닝용 상수 ================= */

/** 입자 1개가 차지하는 화면 면적(px²). 작을수록 촘촘해짐. 입자 수가 화면 크기에 비례하게 하는 기준 */
const AREA_PER_PARTICLE = 35;
/** 입자 수 하한·상한 (모바일 ≈ 9,000개, 데스크톱은 상한에 걸림) */
const MIN_PARTICLES = 8000;
const MAX_PARTICLES = 15000;

/** 작은 입자 지름 범위(px). 전체의 대부분 */
const SMALL_SIZE_MIN = 0.3;
const SMALL_SIZE_MAX = 1.2;
/** 반짝이는 밝은 입자 비율과 지름 범위(px). 이 입자에만 빛번짐 스프라이트를 씀 */
const LARGE_RATIO = 0.04;
const LARGE_SIZE_MIN = 1.5;
const LARGE_SIZE_MAX = 2.5;
/** 반짝이는 입자 밝기 범위. 일반 입자보다 확실히 밝게 */
const LARGE_ALPHA_MIN = 0.85;
const LARGE_ALPHA_MAX = 1;
/** 반짝이는 입자 색: 가장 밝은 연금색 */
const LARGE_COLOR = "#F3DFA2";

/** 일반 입자 밝기 범위 */
const ALPHA_MIN = 0.5;
const ALPHA_MAX = 1;

/** 금가루 색: 확실한 금색 3색 중 랜덤 (tokens.css의 --color-champagne* 과 같은 값). 흰색·회색은 쓰지 않음 */
const DUST_COLORS = ["#E8C77A", "#D4A84B", "#F3DFA2"];

/**
  흐름의 폭: 가우시안 표준편차(σ)를 기준 영역 폭에 대한 비율로.
  입자의 약 95%가 중심선 ±2σ 안에 들어감. 모바일(폭 400px)이면 σ ≈ 32px → 띠 폭 약 130px.
  작을수록 중심에 더 몰려 촘촘해짐
*/
const FLOW_SIGMA_RATIO = 0.08;
/** 이보다 멀리(σ 배수) 떨어진 입자는 다시 뽑음. 화면 끝까지 튀어나가는 입자 방지 */
const MAX_SIGMA = 3;

/** 반짝이는 입자 빛번짐: 입자 지름의 몇 배 크기로, 얼마나 밝게 */
const GLOW_SCALE = 5;
const GLOW_ALPHA = 0.35;

/**
  중심선을 따라 깔리는 옅은 금빛 광채.
  - BAND_ALPHA: 광채가 가장 진한 곳(중심선)의 최종 불투명도. 0.06~0.1 권장, 0이면 광채 없음
  - BAND_RADIUS: 광채 반경(σ 배수). 클수록 넓게 번짐
  색은 금빛(232, 199, 122) 한 가지만 사용 (회색·보라 번짐 방지)
*/
const BAND_ALPHA = 0.08;
const BAND_RADIUS = 2.8;
const BAND_COLOR = "232, 199, 122";

/**
  흐름 경로를 지나는 점들(순서대로). 기준 영역 대비 비율(0~1) 좌표.
  이 점들을 모두 지나는 부드러운 곡선(Catmull-Rom → 3차 베지어)으로 이어 그린다.
  오른쪽 위 화면 밖 → 오른쪽으로 크게 불룩 → 카드 아래쪽 뒤를 지나 왼쪽으로 건너감
  → 왼쪽 아래에서 다시 휘어 화면 밖으로 나가는 물결 모양.
  첫 점과 마지막 점은 화면 밖에 둬서 띠가 화면 안에서 뚝 끊겨 보이지 않게 함
*/
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

/** true면 경로 중심선(하늘색 선)과 FLOW_PATH 점(빨간 점)을 겹쳐 그림. 경로 조정할 때만 켜기 */
const DEBUG_PATH = false;

/* =============================================== */

type Point = { x: number; y: number };

/** 3차 베지어 곡선 하나 = [시작점, 조절점1, 조절점2, 끝점] */
type Segment = [Point, Point, Point, Point];

/**
  입자 하나. 화면 좌표(x, y)가 아니라 '경로 위 위치(t) + 수직 방향 거리(z)'로 저장한다.
  - 화면 크기가 바뀌어도 같은 데이터로 다시 그리기만 하면 됨
  - [애니메이션 단계] t를 아주 조금씩 늘리면 곡선을 따라 흐르고,
    z에 sin(시간 + 입자별 위상) × 작은 값을 더하면 살짝 일렁임
*/
type DustParticle = {
  /** 0~1. S자 경로 위의 위치 (0 = 우상단 시작, 1 = 좌하단 끝) */
  t: number;
  /** 중심선에서 수직으로 떨어진 거리(σ 단위, 가우시안). 0이 중심, ±1σ 안에 약 68% */
  z: number;
  /** 입자 지름(px) */
  size: number;
  /** 입자 고유 밝기. 실제 그릴 때 끝부분 페이드·가장자리 감쇠가 곱해짐 */
  alpha: number;
  color: string;
  /** 큰 입자(빛번짐 있음) 여부 */
  large: boolean;
};

/** 실제 px로 바꿀 때 기준이 되는 영역. S자 모양이 데스크톱에서 옆으로 늘어나지 않게 폭을 제한 */
export type RibbonLayout = {
  /** 기준 영역의 왼쪽 x(px). 화면 가운데 정렬 */
  originX: number;
  /** 기준 영역 폭(px) */
  boxWidth: number;
  /** 기준 영역 높이(px) = 화면 높이 */
  height: number;
  /**
    각 베지어 곡선이 끝나는 지점의 누적 길이 비율(0~1). 마지막 값은 1.
    곡선마다 실제 길이가 달라서, t를 곡선 개수로 똑같이 나누면 짧은 곡선에 입자가 몰려 밀도가 고르지 않게 됨.
    그래서 t를 '전체 길이 중 어디쯤인지'로 보고 이 표로 해당 곡선을 찾음
  */
  segmentEnds: number[];
};

/*
  FLOW_PATH의 점들을 Catmull-Rom 방식으로 이어 3차 베지어 곡선 목록으로 바꾼다.
  점 Pi → Pi+1 구간의 조절점은 앞뒤 점의 방향으로 정해짐:
    조절점1 = Pi   + (Pi+1 − Pi−1) / 6
    조절점2 = Pi+1 − (Pi+2 − Pi)   / 6
  이렇게 하면 모든 점을 정확히 지나면서 이음점에서 꺾이지 않고 부드럽게 휘어짐 (직선 구간 없음).
  양 끝은 이웃 점이 없으므로 끝 점을 한 번 더 쓴 것으로 계산
*/
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

/**
  기준 영역 폭 = 화면 높이의 70%까지만.
  모바일 세로 화면에서는 기준 영역 = 화면 전체라 FLOW_PATH 좌표가 곧 화면 비율이고,
  데스크톱 가로 화면에서는 S자가 옆으로 납작하게 늘어나지 않도록 가운데 영역 기준으로 그림
*/
const BOX_ASPECT = 0.7;

/** 곡선 하나의 길이(px)를 잘게 나눈 직선 길이의 합으로 근사 */
function segmentLength(segment: Segment, boxWidth: number, height: number): number {
  const steps = 24;
  let length = 0;
  let prev = bezierPoint(segment, 0);
  for (let i = 1; i <= steps; i += 1) {
    const next = bezierPoint(segment, i / steps);
    length += Math.hypot((next.x - prev.x) * boxWidth, (next.y - prev.y) * height);
    prev = next;
  }
  return length;
}

export function getLayout(width: number, height: number): RibbonLayout {
  const boxWidth = Math.min(width, height * BOX_ASPECT);

  // 화면 비율에 따라 곡선별 실제 길이가 달라지므로 레이아웃이 바뀔 때마다 다시 계산
  const lengths = PATH.map((segment) => segmentLength(segment, boxWidth, height));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let accumulated = 0;
  const segmentEnds = lengths.map((value) => {
    accumulated += value;
    return accumulated / total;
  });

  return { originX: (width - boxWidth) / 2, boxWidth, height, segmentEnds };
}

/** 화면 면적에 비례한 입자 수. 모바일은 적게, 데스크톱은 많게 */
export function getParticleCount(layout: RibbonLayout): number {
  const count = Math.round((layout.boxWidth * layout.height) / AREA_PER_PARTICLE);
  return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, count));
}

function bezierPoint([a, b, c, d]: Segment, u: number): Point {
  const m = 1 - u;
  return {
    x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x,
    y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y,
  };
}

/** 곡선의 진행 방향(접선). 여기에 수직인 방향이 '띠의 옆쪽'이 됨 */
function bezierTangent([a, b, c, d]: Segment, u: number): Point {
  const m = 1 - u;
  return {
    x: 3 * m * m * (b.x - a.x) + 6 * m * u * (c.x - b.x) + 3 * u * u * (d.x - c.x),
    y: 3 * m * m * (b.y - a.y) + 6 * m * u * (c.y - b.y) + 3 * u * u * (d.y - c.y),
  };
}

/** 경로 위치 t(0~1)의 실제 px 좌표와, 그 지점에서 띠 바깥쪽을 향하는 단위 벡터(법선) */
function samplePath(t: number, layout: RibbonLayout): { point: Point; normal: Point } {
  // t(전체 길이 중 위치)가 속한 곡선을 찾고, 그 곡선 안에서의 위치 u(0~1)로 바꿈
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

  // 비율 좌표 → px. 가로·세로 배율이 달라서 접선도 px 기준으로 바꾼 뒤 법선을 구해야 정확함
  const tx = tangent.x * layout.boxWidth;
  const ty = tangent.y * layout.height;
  const length = Math.hypot(tx, ty) || 1;

  return {
    point: { x: layout.originX + p.x * layout.boxWidth, y: p.y * layout.height },
    normal: { x: -ty / length, y: tx / length },
  };
}

/**
  t 위치에서의 σ(px).
  - taper: 양 끝은 좁고 가운데는 넓게 → 붓으로 그은 듯한 모양
  - ripple: 폭이 기계적으로 매끈하지 않게 잔물결
*/
function flowSigma(t: number, layout: RibbonLayout): number {
  const taper = 0.45 + 0.55 * Math.sin(Math.PI * t);
  const ripple = 1 + 0.12 * Math.sin(t * Math.PI * 5);
  return layout.boxWidth * FLOW_SIGMA_RATIO * taper * ripple;
}

/** 띠 양 끝 10% 구간에서 점점 투명해지게. 비네팅이 띠에는 적용되지 않으므로 끝을 직접 흐려줌 */
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

/** 최대 개수만큼 미리 만들어 두고, 화면 크기에 따라 앞쪽 일부만 그림 */
export function createParticles(seed: number): DustParticle[] {
  const random = createRandom(seed);
  const particles: DustParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push(createParticle(random));
  }
  return particles;
}

/**
  빛번짐 스프라이트(작은 캔버스에 미리 그린 둥근 빛).
  입자마다 shadowBlur를 쓰면 그릴 때마다 블러를 계산해서 매우 느리므로,
  빛 한 장을 offscreen 캔버스에 미리 만들어 두고 drawImage로 찍어내는 방식을 씀
*/
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
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(243, 223, 162, 1)");
  gradient.addColorStop(0.3, "rgba(232, 199, 122, 0.5)");
  gradient.addColorStop(1, "rgba(232, 199, 122, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return sprite;
}

/** 광채 스탬프 개수. 촘촘할수록 광채가 매끈하게 이어짐 */
const BAND_STEPS = 160;

/**
  중심선 광채 레이어를 별도(offscreen) 캔버스에 한 번 그려 둔다.

  방법: 금빛 한 색의 둥근 그라데이션을 중심선을 따라 촘촘히 찍는다(일반 합성).
  겹칠수록 불투명도가 1에 수렴하므로 중심은 고르게 채워지고 가장자리만 부드럽게 사라짐 = 블러된 띠.
  이 레이어 전체를 BAND_ALPHA로 한 번에 얹으니, 아무리 겹쳐도 최종 밝기가 BAND_ALPHA를 넘지 않음.
  (ctx.filter의 blur는 Safari 지원이 불안정해서 이 방식을 씀)

  화면 크기가 바뀔 때만 다시 만들고, 애니메이션 단계에서도 매 프레임 drawImage로 깔기만 하면 됨
*/
export function createGlowBand(layout: RibbonLayout, dpr: number): HTMLCanvasElement {
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

    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    gradient.addColorStop(0, `rgba(${BAND_COLOR}, 1)`);
    gradient.addColorStop(0.5, `rgba(${BAND_COLOR}, 0.4)`);
    gradient.addColorStop(1, `rgba(${BAND_COLOR}, 0)`);

    // 한 장은 옅게 찍고 여러 장이 겹쳐 쌓이게. 양 끝은 endFade로 점점 옅어짐
    ctx.globalAlpha = 0.2 * endFade(t);
    ctx.fillStyle = gradient;
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }

  return band;
}

/**
  띠 전체를 그린다. ① 중심선 광채 → ② 입자.
  매번 clearRect로 완전히 지우고 새로 그림(반투명으로 덮어 지우는 trail 효과는 쓰지 않음 → 꼬리 없음).

  [애니메이션 단계]
  - 매 프레임 이 함수를 다시 호출. 그 전에 각 입자의 t를 (t + 아주 작은 속도) % 1 로 갱신하면
    곡선을 따라 느리게 흐르고, 끝에서 처음으로 돌아가도 endFade 덕분에 갑자기 나타나거나 사라지지 않음
  - 모바일에서 프레임이 떨어지면 MIN_PARTICLES·AREA_PER_PARTICLE부터 조정
*/
export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  layout: RibbonLayout,
  particles: DustParticle[],
  count: number,
  glow: HTMLCanvasElement,
  glowBand: HTMLCanvasElement,
): void {
  const width = layout.originX * 2 + layout.boxWidth;
  ctx.clearRect(0, 0, width, layout.height);

  // ① 중심선 광채: 미리 그려 둔 레이어를 BAND_ALPHA로 한 번만 얹음
  ctx.globalAlpha = BAND_ALPHA;
  ctx.drawImage(glowBand, 0, 0, width, layout.height);

  // ② 입자
  const drawCount = Math.min(count, particles.length);
  for (let i = 0; i < drawCount; i += 1) {
    const particle = particles[i];

    // 바깥(|z|가 클수록)으로 갈수록 최대 60%까지 어두워져, 가장자리가 부드럽게 사라짐
    const edgeFade = 1 - (Math.abs(particle.z) / MAX_SIGMA) * 0.6;
    const alpha = particle.alpha * endFade(particle.t) * edgeFade;
    if (alpha <= 0.01) {
      continue;
    }

    const { point, normal } = samplePath(particle.t, layout);
    const distance = particle.z * flowSigma(particle.t, layout);
    const x = point.x + normal.x * distance;
    const y = point.y + normal.y * distance;

    if (particle.large) {
      // 큰 입자만 빛번짐. 'lighter'로 더하되 alpha를 낮춰 겹쳐도 하얗게 타지 않게
      // [애니메이션 단계] 큰 입자는 alpha에 sin(시간 + 입자별 위상)을 곱해 은은하게 깜빡이게
      const glowSize = particle.size * GLOW_SCALE;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * GLOW_ALPHA;
      ctx.drawImage(glow, x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
    }

    // 입자 본체는 일반 합성(source-over): 촘촘한 중심부에서도 밝기가 누적되지 않아 하얗게 타지 않음
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.size < 1.2) {
      // 아주 작은 가루는 원 대신 사각형으로 찍음(눈으로는 구분 안 되고 훨씬 빠름)
      ctx.fillRect(x - particle.size / 2, y - particle.size / 2, particle.size, particle.size);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, particle.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 다른 그리기에 영향이 없도록 원래 상태로 되돌림
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (DEBUG_PATH) {
    drawDebugPath(ctx, layout);
  }
}

/** [디버그] 경로 중심선과 FLOW_PATH 점을 그려 경로가 의도대로 지나가는지 확인 */
function drawDebugPath(ctx: CanvasRenderingContext2D, layout: RibbonLayout): void {
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
    ctx.arc(layout.originX + p.x * layout.boxWidth, p.y * layout.height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
