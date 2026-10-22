import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { DeckOrigin, TablePhase } from "../types/draw";
import {
  FAN_PLACEMENTS,
  SCATTER_PLACEMENTS,
  SCATTER_RADIUS,
  TILT_JITTER,
  measureFan,
  type CardPlacement,
  type FanGeometry,
} from "../utils/cardLayout";
import { between } from "../utils/random";

const SCATTER_DURATION = 1.2;
const SCATTER_STAGGER = 0.03;
const WASH_ROUNDS = 3;
const WASH_STEP = 0.8;
const WASH_SWIRL = 0.5;
const WASH_SWIRL_JITTER = 0.35;
const WASH_DELAY_JITTER = 0.2;

const GATHER_DURATION = 0.8;
const FAN_SHIFT_DURATION = 0.5;
const FAN_SWEEP_DURATION = 1.2;

const PICK_DURATION = 0.9;
const FLIP_DURATION = 0.8;
const FLIP_HOLD = 0.4;

type TableSize = { width: number; height: number };

// 테이블 기준 %를 가운데에서 떨어진 px로 바꿈. left/top 대신 transform으로 움직여야 매 프레임 레이아웃·다시 그리기가 없음
function offsetX(percent: number, table: TableSize) {
  return ((percent - 50) / 100) * table.width;
}

function offsetY(percent: number, table: TableSize) {
  return ((percent - 50) / 100) * table.height;
}

// 배치 목록을 GSAP 값으로 바꿈(카드 순서대로 각자 다른 값)
function toTweenVars(placements: CardPlacement[], table: TableSize) {
  return {
    x: (index: number) => offsetX(placements[index].x, table),
    y: (index: number) => offsetY(placements[index].y, table),
    rotation: (index: number) => placements[index].rotation,
    scale: 1,
  };
}

function addWashAndGather(
  timeline: gsap.core.Timeline,
  slots: HTMLElement[],
  start: CardPlacement[],
  table: TableSize,
) {
  const cards = start.map((placement) => {
    const dx = (placement.x - 50) * 2;
    const dy = (placement.y - 50) * 2;
    return {
      angle: Math.atan2(dy, dx),
      radius: Math.hypot(dx, dy),
      rotation: placement.rotation,
    };
  });

  for (let round = 0; round < WASH_ROUNDS; round++) {
    const roundStart = timeline.duration();
    slots.forEach((slot, index) => {
      const card = cards[index];
      card.angle +=
        WASH_SWIRL +
        between(Math.random, -WASH_SWIRL_JITTER, WASH_SWIRL_JITTER);
      // 제곱근을 써서 가운데에 몰리지 않고 테이블 전체에 고르게 퍼지게 함
      card.radius = Math.sqrt(Math.random()) * SCATTER_RADIUS;
      const tangent =
        (card.angle * 180) / Math.PI +
        90 +
        between(Math.random, -TILT_JITTER, TILT_JITTER);
      card.rotation += gsap.utils.wrap(-180, 180, tangent - card.rotation);

      // 다음 회차와 겹치면 두 움직임이 서로 덮어쓰므로, 늦게 출발한 만큼 짧게 움직여 회차 안에 끝냄
      const delay = between(Math.random, 0, WASH_DELAY_JITTER);
      timeline.to(
        slot,
        {
          x: offsetX(50 + (Math.cos(card.angle) * card.radius) / 2, table),
          y: offsetY(50 + (Math.sin(card.angle) * card.radius) / 2, table),
          rotation: card.rotation,
          duration: WASH_STEP - delay,
          ease: "sine.inOut",
        },
        roundStart + delay,
      );
    });
  }

  const gatherStart = timeline.duration();
  slots.forEach((slot, index) => {
    const delay = between(Math.random, 0, WASH_DELAY_JITTER);
    timeline.to(
      slot,
      {
        x: 0,
        y: 0,
        rotation: Math.round(cards[index].rotation / 360) * 360,
        duration: GATHER_DURATION - delay,
        ease: "power2.inOut",
      },
      gatherStart + delay,
    );
  });
  timeline.set(slots, { rotation: 0 });
}

type TableAnimationOptions = {
  tableRef: RefObject<HTMLDivElement>;
  phase: TablePhase;
  origin: DeckOrigin | null;
  selected: number | null;
  onWashEnd: () => void;
  onFanReady: (fan: FanGeometry) => void;
  onRevealEnd: (rect: DOMRect) => void;
};

// 테이블 22장의 단계별 움직임: 흩어지기·워싱·모으기 → 펼치기 → 고른 카드 뒤집기
export function useTableAnimation({
  tableRef,
  phase,
  origin,
  selected,
  onWashEnd,
  onFanReady,
  onRevealEnd,
}: TableAnimationOptions) {
  useGSAP(
    () => {
      const table = tableRef.current;
      if (!table) return;
      const slots = gsap.utils.toArray<HTMLElement>(".card-table__slot", table);

      gsap.set(slots, { xPercent: -50, yPercent: -50 });
      const tableSize = {
        width: table.offsetWidth,
        height: table.offsetHeight,
      };

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (phase === "revealing") {
        if (selected === null) return;
        const slot = slots[selected];
        const card = slot.querySelector<HTMLElement>(".card");
        if (!card) return;
        const others = slots.filter((_, index) => index !== selected);
        const finish = () => onRevealEnd(card.getBoundingClientRect());

        // 부채꼴로 카드 펼치기
        const tableRect = table.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        gsap.set(slot, {
          transformOrigin: "50% 50%",
          x:
            slotRect.left +
            slotRect.width / 2 -
            (tableRect.left + tableRect.width / 2),
          y:
            slotRect.top +
            slotRect.height / 2 -
            (tableRect.top + tableRect.height / 2),
          zIndex: 1,
        });

        // 결과 화면 카드 확대
        const revealWidth = Math.min(
          tableRect.width * 0.6,
          (tableRect.height * 0.8) / 1.5,
        );
        const picked = {
          x: 0,
          y: 0,
          rotation: 0,
          scale: revealWidth / slot.offsetWidth,
        };
        gsap.set(card, { transformPerspective: card.offsetWidth * 4 });

        if (reduceMotion) {
          gsap.set(others, { autoAlpha: 0 });
          gsap.set(slot, picked);
          gsap.set(card, { rotationY: 180 });
          gsap.delayedCall(0, finish);
          return;
        }
        gsap
          .timeline({ onComplete: finish })
          .to(others, { autoAlpha: 0, duration: 0.6, ease: "power1.out" })
          .to(
            slot,
            { ...picked, duration: PICK_DURATION, ease: "power2.inOut" },
            0,
          )
          .to(card, { y: 0, duration: PICK_DURATION, ease: "power2.inOut" }, 0)
          .to(card, {
            rotationY: 180,
            duration: FLIP_DURATION,
            ease: "power2.inOut",
          })
          .to({}, { duration: FLIP_HOLD });
        return;
      }

      if (phase === "fanned") {
        const fan = toTweenVars(FAN_PLACEMENTS, tableSize);
        const ready = () => onFanReady(measureFan(slots[0]));
        if (reduceMotion) {
          gsap.set(slots, fan);
          gsap.delayedCall(0, ready);
          return;
        }

        // useGSAP이 첫 단계(워싱)를 되돌려 값이 지워지므로(배포 빌드에서만), 모은 상태를 다시 정함
        gsap.set(slots, { ...fan, rotation: 0 });
        const angles = FAN_PLACEMENTS.map((placement) => placement.rotation);
        const setRotations = slots.map((slot) =>
          gsap.quickSetter(slot, "rotation", "deg"),
        );
        const hand = { angle: 0 };
        gsap
          .timeline({ onComplete: ready })
          .to(hand, {
            angle: angles[0],
            duration: FAN_SHIFT_DURATION,
            ease: "power2.inOut",
            onUpdate: () => setRotations.forEach((set) => set(hand.angle)),
          })
          .to(hand, {
            angle: angles[angles.length - 1],
            duration: FAN_SWEEP_DURATION,
            ease: "power1.inOut",
            onUpdate: () =>
              setRotations.forEach((set, index) =>
                set(Math.max(angles[index], hand.angle)),
              ),
          });
        return;
      }

      const scatter = toTweenVars(SCATTER_PLACEMENTS, tableSize);
      if (reduceMotion) {
        gsap.set(slots, scatter);
        gsap.delayedCall(0, onWashEnd);
        return;
      }

      const rect = table.getBoundingClientRect();
      // 시작 화면에서 오면 카드 더미 자리에서, 다시 뽑기면 테이블 가운데에서 흐리게 나타나며 흩어짐
      const deck = origin
        ? {
            x: origin.centerX - (rect.left + rect.width / 2),
            y: origin.centerY - (rect.top + rect.height / 2),
            rotation: 0,
            scale: origin.width / slots[0].offsetWidth,
            autoAlpha: 1,
          }
        : { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 0 };
      const timeline = gsap
        .timeline({ onComplete: onWashEnd })
        .fromTo(slots, deck, {
          ...scatter,
          autoAlpha: 1,
          duration: SCATTER_DURATION,
          ease: "power2.inOut",
          stagger: { each: SCATTER_STAGGER, from: "end" },
        });
      addWashAndGather(timeline, slots, SCATTER_PLACEMENTS, tableSize);
    },
    { scope: tableRef, dependencies: [phase, origin] },
  );
}
