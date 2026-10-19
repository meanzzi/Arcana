/*
  S자 금가루 띠의 입자 생성·그리기 로직.
  React 컴포넌트(GoldDustRibbon.tsx)와 분리해 두어, 애니메이션 단계에서
  프레임마다 drawRibbon만 다시 호출하는 식으로 그대로 재사용할 수 있게 함.

  구성 (모두 같은 S자 경로를 기준으로 함)
  - 바닥 안개 2겹: 넓고 옅은 안개 + 중심을 따라가는 좁고 밝은 빛줄기
  - 가닥(strand) 여러 개: 각자 다른 박자로 물결치며 꼬였다 갈라졌다 함 → 한 줄이 아닌 '결' 느낌
  - 입자 4종: 미세 가루 / 중간 입자 / 반짝이 / 띠 바깥에 흩날리는 가루
  - 일부 입자는 점 대신 진행 방향으로 짧은 빛줄기, 가장 밝은 반짝이 몇 개는 십자 빛
*/

type Point = { x: number; y: number };

/** 3차 베지어 곡선 하나 = [시작점, 조절점1, 조절점2, 끝점] */
type Segment = [Point, Point, Point, Point];

/**
  가닥 하나. 띠 안에서 중심선과 나란히 흐르되, 옆으로 물결치는 위치와 진하기가 t에 따라 변함.
  가닥마다 박자(frequency, phase)가 달라서 서로 교차하고 모였다 흩어짐
*/
type Strand = {
  /** 가닥의 기본 위치(띠 반폭 기준, -1~1) */
  base: number;
  /** 옆으로 물결치는 폭 */
  amplitude: number;
  /** 띠 전체 길이 동안 물결치는 횟수 */
  frequency: number;
  phase: number;
  /** 가닥 굵기(입자가 가닥 중심에서 퍼지는 정도) */
  spread: number;
  /** 가닥이 진해졌다 옅어지는 횟수. 가닥이 끊겼다 이어지는 듯한 느낌을 줌 */
  fadeFrequency: number;
  fadePhase: number;
};

/**
  - fine: 미세 가루. 대부분을 차지하며 질감을 채움
  - mid: 중간 입자. 반짝임의 몸통
  - sparkle: 크고 밝은 반짝이(빛번짐 있음)
  - halo: 띠 바깥 멀리까지 흩날리는 아주 옅은 가루. 띠 경계가 공기 중으로 번지게 함
*/
type ParticleKind = "fine" | "mid" | "sparkle" | "halo";

/**
  입자 하나. 화면 좌표(x, y)가 아니라 '경로 위 위치(t) + 가닥 + 가닥 안에서의 위치'로 저장한다.
  - 화면 크기가 바뀌어도 같은 데이터로 다시 그리기만 하면 됨
  - [애니메이션 단계] t만 조금씩 늘리면 입자가 가닥을 따라 S자로 흘러감
    (가닥 위치는 t로부터 매번 계산하므로, 흐르면서 가닥의 물결도 자연스럽게 따라감)
*/
type DustParticle = {
  /** 0~1. S자 경로 위의 위치 (0 = 우상단 시작, 1 = 좌하단 끝) */
  t: number;
  /** 속한 가닥 번호. halo 입자는 가닥 없이 띠 전체 기준으로 흩어지므로 -1 */
  strand: number;
  /** 가닥 중심에서 옆으로 벗어난 정도(띠 반폭 기준). halo는 띠 중심선 기준 */
  localOffset: number;
  kind: ParticleKind;
  /** 입자 지름(px) */
  size: number;
  /** 입자 고유 밝기(0~1). 실제 그릴 때 끝부분 페이드·가닥 진하기 등이 곱해짐 */
  alpha: number;
  color: string;
  /** 0이면 점, 0보다 크면 진행 방향으로 그 길이(px)만큼 짧은 빛줄기로 그림 */
  streakLength: number;
  /** 십자 빛을 다는 가장 밝은 반짝이 여부 */
  flare: boolean;
};

/** 띠 하나를 그리는 데 필요한 데이터 묶음. 한 번 만들어 두고 계속 재사용 */
export type RibbonData = {
  strands: Strand[];
  particles: DustParticle[];
};

/** 실제 px로 바꿀 때 기준이 되는 영역. S자 모양이 데스크톱에서 옆으로 늘어나지 않게 폭을 제한 */
export type RibbonLayout = {
  /** 기준 영역의 왼쪽 x(px). 화면 가운데 정렬 */
  originX: number;
  /** 기준 영역 폭(px) */
  boxWidth: number;
  /** 기준 영역 높이(px) = 화면 높이 */
  height: number;
};

/** 그리기용 스프라이트 묶음. 미리 한 번 그려 두고 drawImage로 찍어냄 */
export type RibbonSprites = {
  glow: HTMLCanvasElement;
  flare: HTMLCanvasElement;
};

// 디자인 시스템 색: 금박 / 양피지
const GOLD = "rgb(201, 162, 74)";
const PARCHMENT = "rgb(230, 213, 168)";

/*
  입자 중 양피지색(밝고 옅은 색)의 비율. 높일수록 금가루 전체 색이 옅어짐.
  디자인 시스템의 '세 색 + 투명도 변형만' 규칙을 지키기 위해 새 색을 만들지 않고 비율로 조절
*/
const PARCHMENT_RATIO = 0.5;
/** 반짝이는 더 밝게 빛나 보이도록 양피지색 비율을 따로 높게 */
const SPARKLE_PARCHMENT_RATIO = 0.75;

/*
  S자 경로. 좌표는 px가 아니라 기준 영역 대비 비율(0~1)이라 화면 크기에 맞춰 자동으로 늘고 줄어든다.
  우상단 바깥에서 시작 → 오른쪽 가장자리로 부풀며 내려옴 → 카드 아래쪽 뒤를 지나
  → 왼쪽으로 부풀었다가 → 아래 바깥으로 빠져나감.
  두 곡선이 만나는 점(0.55, 0.56)에서 양쪽 조절점이 일직선이 되게 맞춰 꺾임 없이 부드럽게 이어짐.
  시작·끝을 화면 밖(-0.03, 1.05)에 둬서 띠가 화면 안에서 뚝 끊겨 보이지 않게 함
*/
const PATH: Segment[] = [
  [
    { x: 0.6, y: -0.03 },
    { x: 1.0, y: 0.18 },
    { x: 0.98, y: 0.45 },
    { x: 0.55, y: 0.56 },
  ],
  [
    { x: 0.55, y: 0.56 },
    { x: 0.12, y: 0.67 },
    { x: -0.08, y: 0.82 },
    { x: 0.3, y: 1.05 },
  ],
];

/** 미리 만들어 둘 최대 입자 수. 화면이 작으면 이 중 앞쪽 일부만 그림 */
const MAX_PARTICLES = 22000;
const MIN_PARTICLES = 8000;

/** 가닥 개수 */
const STRAND_COUNT = 6;

/** 기준 영역 폭 = 화면 높이의 70%까지만. 데스크톱 가로 화면에서 S자가 납작하게 퍼지는 것을 막음 */
const BOX_ASPECT = 0.7;

/** 띠의 최대 반폭 = 기준 영역 폭의 17% */
const BAND_HALF_WIDTH_RATIO = 0.17;

/** 바닥 안개를 찍을 횟수. 촘촘할수록 안개가 매끈하게 이어짐 */
const HAZE_STEPS = 120;

/*
  시드가 있는 랜덤(mulberry32).
  Math.random()은 새로고침마다 띠 모양이 달라지므로, 같은 시드면 항상 같은 결과가 나오는 랜덤을 씀
*/
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** 랜덤 4개의 평균 → 0 근처에 몰리는 종 모양 분포(-1~1). 중심은 빽빽하고 가장자리는 드문드문 */
function bellRandom(random: () => number): number {
  return ((random() + random() + random() + random()) / 4 - 0.5) * 2;
}

function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function getLayout(width: number, height: number): RibbonLayout {
  const boxWidth = Math.min(width, height * BOX_ASPECT);
  return { originX: (width - boxWidth) / 2, boxWidth, height };
}

/** 화면 면적에 비례한 입자 수. 모바일은 적게, 데스크톱은 많게 */
export function getParticleCount(layout: RibbonLayout): number {
  const count = Math.round((layout.boxWidth * layout.height) / 20);
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

/**
  경로 위치 t(0~1)의 실제 px 좌표와 단위 벡터 두 개.
  - tangent: 진행 방향 (빛줄기를 이 방향으로 그림)
  - normal: 띠 바깥쪽 방향 (가닥·입자를 이 방향으로 벌림)
*/
function samplePath(t: number, layout: RibbonLayout): { point: Point; tangent: Point; normal: Point } {
  // t 0~0.5는 첫 번째 곡선, 0.5~1은 두 번째 곡선
  const scaled = Math.min(t, 0.9999) * PATH.length;
  const segment = PATH[Math.floor(scaled)];
  const u = scaled - Math.floor(scaled);

  const p = bezierPoint(segment, u);
  const rawTangent = bezierTangent(segment, u);

  // 비율 좌표 → px. 가로·세로 배율이 달라서 접선도 px 기준으로 바꾼 뒤 정규화해야 정확함
  const tx = rawTangent.x * layout.boxWidth;
  const ty = rawTangent.y * layout.height;
  const length = Math.hypot(tx, ty) || 1;

  return {
    point: { x: layout.originX + p.x * layout.boxWidth, y: p.y * layout.height },
    tangent: { x: tx / length, y: ty / length },
    normal: { x: -ty / length, y: tx / length },
  };
}

/**
  t 위치에서의 띠 반폭(px).
  - taper: sin(πt)로 양 끝은 가늘고 가운데는 넓게 → 붓으로 그은 듯한 모양
  - ripple: 잔물결을 섞어 폭이 기계적으로 매끈하지 않게
  - twist: S자가 방향을 바꾸는 지점(t=0.5)에서 폭을 잠깐 좁혀 리본이 한 번 뒤집히는 것처럼 보이게
*/
function bandHalfWidth(t: number, layout: RibbonLayout): number {
  const taper = 0.35 + 0.65 * Math.sin(Math.PI * t);
  const ripple = 1 + 0.15 * Math.sin(t * Math.PI * 5);
  const twist = 1 - 0.55 * Math.exp(-(((t - 0.5) / 0.07) ** 2));
  return layout.boxWidth * BAND_HALF_WIDTH_RATIO * taper * ripple * twist;
}

/** 띠 양 끝 10% 구간에서 점점 투명해지게. 비네팅이 띠에는 적용되지 않으므로 끝을 직접 흐려줌 */
function endFade(t: number): number {
  return Math.min(1, t / 0.1, (1 - t) / 0.1);
}

/**
  t 위치의 입자 밀도(0~1). 박자가 다른 sin 두 개를 섞어 불규칙하게 진했다 옅어짐.
  띠 전체가 고르게 채워지지 않고 '뭉친 곳 / 성긴 곳'의 리듬이 생김
*/
function density(t: number): number {
  return 0.5 + 0.3 * Math.sin(Math.PI * 2 * (2.3 * t + 0.1)) + 0.2 * Math.sin(Math.PI * 2 * (5.7 * t + 0.6));
}

/** 가닥 중심이 t 위치에서 띠 중심선으로부터 떨어진 정도(띠 반폭 기준) */
function strandCenter(strand: Strand, t: number): number {
  return strand.base + strand.amplitude * Math.sin(Math.PI * 2 * (strand.frequency * t + strand.phase));
}

/** 가닥의 t 위치에서의 진하기(0.35~1). 가닥이 진해졌다 옅어지며 끊겼다 이어지는 듯 보임 */
function strandFade(strand: Strand, t: number): number {
  const wave = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (strand.fadeFrequency * t + strand.fadePhase));
  return 0.35 + 0.65 * wave;
}

function createStrands(random: () => number): Strand[] {
  const strands: Strand[] = [];
  for (let i = 0; i < STRAND_COUNT; i += 1) {
    strands.push({
      // 띠 폭(-0.7~0.7)에 고르게 나눠 배치하고 살짝씩 어긋나게
      base: -0.7 + (1.4 * i) / (STRAND_COUNT - 1) + (random() - 0.5) * 0.15,
      amplitude: between(random, 0.15, 0.4),
      frequency: between(random, 1, 3),
      phase: random(),
      spread: between(random, 0.1, 0.22),
      fadeFrequency: between(random, 1, 2.5),
      fadePhase: random(),
    });
  }
  return strands;
}

function createParticle(random: () => number): DustParticle {
  // 띠 위치: 밀도가 낮은 곳일수록 입자가 덜 생기도록 거름(밀도 덩어리)
  let t = random();
  while (random() > 0.25 + 0.75 * density(t)) {
    t = random();
  }

  // 12%는 띠 바깥까지 넓게 흩날리는 halo
  if (random() < 0.12) {
    return {
      t,
      strand: -1,
      localOffset: bellRandom(random) * 3.5,
      kind: "halo",
      size: between(random, 0.3, 1),
      alpha: between(random, 0.08, 0.3),
      color: random() < PARCHMENT_RATIO ? PARCHMENT : GOLD,
      streakLength: 0,
      flare: false,
    };
  }

  const strand = Math.floor(random() * STRAND_COUNT);
  const kindRoll = random();

  // 띠 안쪽 입자 비율: 미세 가루 80% / 중간 입자 15% / 반짝이 5%
  if (kindRoll < 0.05) {
    return {
      t,
      strand,
      localOffset: bellRandom(random),
      kind: "sparkle",
      size: between(random, 1.6, 2.8),
      alpha: between(random, 0.7, 1),
      color: random() < SPARKLE_PARCHMENT_RATIO ? PARCHMENT : GOLD,
      streakLength: 0,
      // 반짝이 중 2%(전체 입자 중 약 0.1%)만 십자 빛
      flare: random() < 0.02,
    };
  }

  const isMid = kindRoll < 0.2;
  return {
    t,
    strand,
    localOffset: bellRandom(random),
    kind: isMid ? "mid" : "fine",
    size: isMid ? between(random, 0.9, 1.6) : between(random, 0.3, 0.9),
    alpha: isMid ? between(random, 0.4, 0.9) : between(random, 0.15, 0.55),
    color: random() < PARCHMENT_RATIO ? PARCHMENT : GOLD,
    // 15%는 진행 방향으로 짧은 빛줄기 → 흐르는 방향감
    streakLength: random() < 0.15 ? between(random, 3, 9) : 0,
    flare: false,
  };
}

export function createRibbon(seed: number): RibbonData {
  const random = createRandom(seed);
  const strands = createStrands(random);
  const particles: DustParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push(createParticle(random));
  }
  return { strands, particles };
}

/**
  빛번짐 스프라이트(작은 캔버스에 미리 그린 둥근 빛).
  Canvas의 shadowBlur는 그릴 때마다 블러를 계산해서 매우 느리므로,
  빛 한 장을 미리 만들어 두고 drawImage로 찍어내는 방식을 씀
*/
function createGlowSprite(): HTMLCanvasElement {
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
  gradient.addColorStop(0, "rgba(230, 213, 168, 1)");
  gradient.addColorStop(0.25, "rgba(201, 162, 74, 0.6)");
  gradient.addColorStop(1, "rgba(201, 162, 74, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return sprite;
}

/** 십자 빛 스프라이트. 배경의 큰 별(.stardust-flares)과 같은 모양으로 맞춤 */
function createFlareSprite(): HTMLCanvasElement {
  const size = 64;
  const center = size / 2;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;

  const ctx = sprite.getContext("2d");
  if (!ctx) {
    return sprite;
  }

  // 가로·세로 빛줄기: 가운데가 밝고 양 끝으로 사라지는 1px 선
  const horizontal = ctx.createLinearGradient(0, 0, size, 0);
  horizontal.addColorStop(0, "rgba(230, 213, 168, 0)");
  horizontal.addColorStop(0.5, "rgba(230, 213, 168, 1)");
  horizontal.addColorStop(1, "rgba(230, 213, 168, 0)");
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, center - 0.5, size, 1);

  const vertical = ctx.createLinearGradient(0, 0, 0, size);
  vertical.addColorStop(0, "rgba(230, 213, 168, 0)");
  vertical.addColorStop(0.5, "rgba(230, 213, 168, 1)");
  vertical.addColorStop(1, "rgba(230, 213, 168, 0)");
  ctx.fillStyle = vertical;
  ctx.fillRect(center - 0.5, 0, 1, size);

  // 가운데 작은 빛망울
  const core = ctx.createRadialGradient(center, center, 0, center, center, 8);
  core.addColorStop(0, "rgba(230, 213, 168, 1)");
  core.addColorStop(1, "rgba(201, 162, 74, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(center - 8, center - 8, 16, 16);

  return sprite;
}

export function createSprites(): RibbonSprites {
  return { glow: createGlowSprite(), flare: createFlareSprite() };
}

/**
  바닥 안개 2겹.
  - 넓은 안개: 띠 전체를 감싸는 옅은 금빛
  - 중심 빛줄기: 띠 가운데를 따라 좁고 밝게 → 띠 안쪽이 은은하게 빛나 보임
  스탬프가 서로 많이 겹치므로(lighter 합성으로 더해짐) 한 장의 alpha는 아주 낮게 둠
*/
function drawHaze(ctx: CanvasRenderingContext2D, layout: RibbonLayout, glow: HTMLCanvasElement): void {
  for (let i = 0; i < HAZE_STEPS; i += 1) {
    const t = i / (HAZE_STEPS - 1);
    const { point } = samplePath(t, layout);
    const halfWidth = bandHalfWidth(t, layout);
    const fade = endFade(t);

    const wide = halfWidth * 2.6;
    ctx.globalAlpha = 0.009 * fade;
    ctx.drawImage(glow, point.x - wide, point.y - wide, wide * 2, wide * 2);

    const core = halfWidth * 0.9;
    ctx.globalAlpha = 0.022 * fade;
    ctx.drawImage(glow, point.x - core, point.y - core, core * 2, core * 2);
  }
}

/**
  띠 전체를 그린다. ① 바닥 안개 → ② 입자.
  'lighter' 합성은 그리는 순서와 상관없이 빛이 더해지기만 하므로, 입자 종류별로 나눠 그리지 않고 한 번에 돎.

  [애니메이션 단계]
  - 매 프레임 이 함수를 다시 호출. 그 전에 각 입자의 t를 (t + 속도) % 1 로 갱신하면 가닥을 따라 흐르고,
    끝에서 처음으로 돌아가도 endFade 덕분에 갑자기 나타나거나 사라지지 않음
  - 안개는 움직이지 않으므로 별도 캔버스에 한 번만 그려 두고 매 프레임 drawImage로 깔기만 할 것 (성능)
  - 모바일에서는 움직이는 입자 수를 1만 개 정도로 줄이는 것을 검토
*/
export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  layout: RibbonLayout,
  ribbon: RibbonData,
  count: number,
  sprites: RibbonSprites,
): void {
  ctx.clearRect(0, 0, layout.originX * 2 + layout.boxWidth, layout.height);

  // 'lighter' = 겹치는 빛이 더해져 밝아짐. 금가루가 몰린 곳이 자연스럽게 더 빛나 보임
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  // ① 바닥 안개
  drawHaze(ctx, layout, sprites.glow);

  // ② 입자
  const drawCount = Math.min(count, ribbon.particles.length);
  for (let i = 0; i < drawCount; i += 1) {
    const particle = ribbon.particles[i];
    const { point, tangent, normal } = samplePath(particle.t, layout);

    // 띠 중심선에서 벌어질 거리: 가닥 위치 + 가닥 안에서의 위치. halo는 가닥 없이 중심선 기준
    let offset: number;
    let strength: number;
    if (particle.strand < 0) {
      offset = particle.localOffset;
      strength = 1;
    } else {
      const strand = ribbon.strands[particle.strand];
      offset = strandCenter(strand, particle.t) + particle.localOffset * strand.spread;
      // 띠 가장자리로 갈수록 살짝(최대 25%) 어두워짐 × 가닥 진하기
      strength = (1 - Math.min(1, Math.abs(offset)) * 0.25) * strandFade(strand, particle.t);
    }

    const alpha = particle.alpha * endFade(particle.t) * strength;
    if (alpha <= 0.01) {
      continue;
    }

    const distance = offset * bandHalfWidth(particle.t, layout);
    const x = point.x + normal.x * distance;
    const y = point.y + normal.y * distance;

    if (particle.kind === "sparkle") {
      // 반짝이: 입자 크기의 6배짜리 빛번짐을 먼저 깔고 그 위에 점을 찍음
      // [애니메이션 단계] 반짝이만 alpha에 sin(시간 + 입자별 위상)을 곱해 각자 깜빡이게 할 예정
      const glow = particle.size * 6;
      ctx.globalAlpha = alpha * 0.5;
      ctx.drawImage(sprites.glow, x - glow / 2, y - glow / 2, glow, glow);

      if (particle.flare) {
        // [애니메이션 단계] 십자 빛은 배경의 큰 별처럼 크기·밝기가 천천히 커졌다 작아지게
        const flare = particle.size * 12;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprites.flare, x - flare / 2, y - flare / 2, flare, flare);
      }
    }

    ctx.globalAlpha = alpha;

    if (particle.streakLength > 0) {
      // 짧은 빛줄기: 입자 위치를 가운데로 두고 진행 방향(접선)으로 양쪽에 반씩
      const half = particle.streakLength / 2;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = Math.max(0.5, particle.size * 0.7);
      ctx.beginPath();
      ctx.moveTo(x - tangent.x * half, y - tangent.y * half);
      ctx.lineTo(x + tangent.x * half, y + tangent.y * half);
      ctx.stroke();
      continue;
    }

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
}
