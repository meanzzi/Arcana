import gsap from "gsap";
import { between, createRandom } from "./random";

export const CARD_COUNT = 22;
export const SCATTER_RADIUS = 92;
export const TILT_JITTER = 30;
const SCATTER_SEED = 7;
const RADIUS_JITTER = 10;

const FAN_SPREAD = 100;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// 테이블 기준 위치(%)와 기울기(도)
export type CardPlacement = {
  x: number;
  y: number;
  rotation: number;
};

function createScatter(): CardPlacement[] {
  const random = createRandom(SCATTER_SEED);
  return Array.from({ length: CARD_COUNT }, (_, index) => {
    const angle = index * GOLDEN_ANGLE;
    // 제곱근을 쓰면 바깥으로 갈수록 간격이 넓어져, 면적당 카드 수가 고르게 됨
    const radius =
      Math.sqrt((index + 0.5) / CARD_COUNT) * SCATTER_RADIUS +
      between(random, -RADIUS_JITTER, RADIUS_JITTER);
    // 접선 방향 = 중심에서 바깥을 향한 각도 + 90도
    const tangent = (angle * 180) / Math.PI + 90;
    return {
      x: 50 + (Math.cos(angle) * radius) / 2,
      y: 50 + (Math.sin(angle) * radius) / 2,
      // 황금각을 계속 더해서 뒤쪽 카드는 수천 도가 되므로, 같은 방향의 -180~180도로 바꿈.
      rotation: gsap.utils.wrap(
        -180,
        180,
        tangent + between(random, -TILT_JITTER, TILT_JITTER),
      ),
    };
  });
}

function createFan(): CardPlacement[] {
  const step = FAN_SPREAD / (CARD_COUNT - 1);
  return Array.from({ length: CARD_COUNT }, (_, index) => ({
    x: 50,
    y: 50,
    rotation: FAN_SPREAD / 2 - index * step,
  }));
}

export const SCATTER_PLACEMENTS = createScatter();
export const FAN_PLACEMENTS = createFan();

// 펼쳐진 부채꼴의 모양(테이블 기준 px). 포인터 아래 카드를 계산할 때 씀
export type FanGeometry = {
  pivotX: number;
  pivotY: number;
  radius: number;
  cardWidth: number;
  cardHeight: number;
};

// 회전축 위치를 CSS(transform-origin)에서 읽어 와서 JS에 같은 값을 따로 두지 않음
export function measureFan(slot: HTMLElement): FanGeometry {
  const [originX, originY] = getComputedStyle(slot)
    .transformOrigin.split(" ")
    .map(parseFloat);
  const cardWidth = slot.offsetWidth;
  const cardHeight = slot.offsetHeight;
  return {
    pivotX: slot.offsetLeft + originX - cardWidth / 2,
    pivotY: slot.offsetTop + originY - cardHeight / 2,
    radius: cardHeight / 2 - originY,
    cardWidth,
    cardHeight,
  };
}

/*
  포인터 아래에 보이는 맨 위 카드 번호. 카드 요소의 마우스 이벤트 대신 각도로 계산해서,
  튀어오른 카드가 옆 카드를 덮어도 결과가 바뀌지 않음(경계에서 두 카드가 번갈아 튀지 않음).
  오른쪽 카드가 위에 겹치므로, 포인터 각도를 덮는 카드 중 가장 오른쪽(번호가 큰) 카드를 고름
*/
export function cardAt(fan: FanGeometry, x: number, y: number): number | null {
  const dx = x - fan.pivotX;
  const dy = y - fan.pivotY;
  const distance = Math.hypot(dx, dy);
  if (Math.abs(distance - fan.radius) > fan.cardHeight / 2) return null;

  const angle = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const halfWidth = (Math.atan(fan.cardWidth / 2 / distance) * 180) / Math.PI;
  const step = FAN_SPREAD / (CARD_COUNT - 1);
  const index = Math.min(
    CARD_COUNT - 1,
    Math.floor((FAN_SPREAD / 2 - angle + halfWidth) / step),
  );
  if (index < 0) return null;
  const cardAngle = FAN_SPREAD / 2 - index * step;
  return Math.abs(angle - cardAngle) <= halfWidth ? index : null;
}
