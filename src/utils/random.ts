export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(
  random: () => number,
  min: number,
  max: number,
): number {
  return min + random() * (max - min);
}

// 표준 정규분포(가우시안) 랜덤. 0 근처에 몰리고 멀어질수록 드물어짐 (Box-Muller 변환)
export function gaussianRandom(random: () => number): number {
  // 1 - random()으로 0을 피함(log(0) 방지)
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

// 배열에서 하나를 무작위로 고름. 뽑기 결과처럼 매번 달라야 하는 곳에서 사용(Math.random)
export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
