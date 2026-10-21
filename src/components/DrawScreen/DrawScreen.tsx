import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import { useShare } from "../../hooks/useShare";
import { between, createRandom } from "../../utils/random";
import type { DrawResult } from "../../types/card";
import "./DrawScreen.css";

const CARD_COUNT = 22;
const SCATTER_SEED = 7;
const SCATTER_RADIUS = 92;
const RADIUS_JITTER = 10;
const TILT_JITTER = 30;

const FAN_SPREAD = 100;

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

const POP_DISTANCE = 0.18;
const POP_DURATION = 0.25;

const PICK_DURATION = 0.9;
const FLIP_DURATION = 0.8;
const FLIP_HOLD = 0.4;
const RISE_DURATION = 0.8;
const READING_DURATION = 0.6;

const TILT_MAX = 10;
const TILT_FOLLOW = 0.5;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type DrawPhase = "scattered" | "fanned" | "revealing" | "result";

export type DeckOrigin = {
  centerX: number;
  centerY: number;
  width: number;
};

type TablePhase = Exclude<DrawPhase, "revealing" | "result">;

type CardPlacement = {
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

const PLACEMENTS: Record<TablePhase, CardPlacement[]> = {
  scattered: createScatter(),
  fanned: createFan(),
};

function addWashAndGather(
  timeline: gsap.core.Timeline,
  slots: HTMLElement[],
  start: CardPlacement[],
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
          left: `${50 + (Math.cos(card.angle) * card.radius) / 2}%`,
          top: `${50 + (Math.sin(card.angle) * card.radius) / 2}%`,
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
        left: "50%",
        top: "50%",
        rotation: Math.round(cards[index].rotation / 360) * 360,
        duration: GATHER_DURATION - delay,
        ease: "power2.inOut",
      },
      gatherStart + delay,
    );
  });
  timeline.set(slots, { rotation: 0 });
}

// 배치 목록을 GSAP 값으로 바꿈(카드 순서대로 각자 다른 값)
function toTweenVars(placements: CardPlacement[]) {
  return {
    left: (index: number) => `${placements[index].x}%`,
    top: (index: number) => `${placements[index].y}%`,
    rotation: (index: number) => placements[index].rotation,
    scale: 1,
  };
}

// 펼쳐진 부채꼴의 모양(테이블 기준 px). 포인터 아래 카드를 계산할 때 씀
type FanGeometry = {
  pivotX: number;
  pivotY: number;
  radius: number;
  cardWidth: number;
  cardHeight: number;
};

// 회전축 위치를 CSS(transform-origin)에서 읽어 와서 JS에 같은 값을 따로 두지 않음
function measureFan(slot: HTMLElement): FanGeometry {
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
function cardAt(fan: FanGeometry, x: number, y: number): number | null {
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

type DrawScreenProps = {
  phase: DrawPhase;
  result: DrawResult | null;
  origin: DeckOrigin | null;
  onWashEnd: () => void;
  onFanEnd: () => void;
  onSelect: () => void;
  onRevealEnd: () => void;
  onResultEnd: () => void;
  onRedraw: () => void;
};

function DrawScreen({
  phase,
  result,
  origin,
  onWashEnd,
  onFanEnd,
  onSelect,
  onRevealEnd,
  onResultEnd,
  onRedraw,
}: DrawScreenProps) {
  const selectable = phase === "fanned";
  const { notice, share } = useShare();
  const screenRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const revealedRectRef = useRef<DOMRect | null>(null);

  const fanRef = useRef<FanGeometry | null>(null);
  const hoveredRef = useRef<number | null>(null);

  const tiltRef = useRef<((x: number, y: number) => void) | null>(null);

  const { contextSafe } = useGSAP(
    () => {
      fanRef.current = null;
      hoveredRef.current = null;
      tiltRef.current = null;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (phase === "result") {
        const card = screenRef.current?.querySelector<HTMLElement>(
          ".draw-screen__result-card",
        );
        const from = revealedRectRef.current;
        if (!card || !from || reduceMotion) {
          gsap.delayedCall(0, onResultEnd);
          return;
        }

        // 금박 틸트
        gsap.set(card, {
          transformPerspective: card.offsetWidth * 3,
          "--sheen-x": 50,
          "--sheen-y": 50,
          "--sheen-on": 0,
        });
        const follow = { duration: TILT_FOLLOW, ease: "power3.out" };
        const rotateX = gsap.quickTo(card, "rotationX", follow);
        const rotateY = gsap.quickTo(card, "rotationY", follow);
        const sheenX = gsap.quickTo(card, "--sheen-x", follow);
        const sheenY = gsap.quickTo(card, "--sheen-y", follow);
        const sheenOn = gsap.quickTo(card, "--sheen-on", follow);
        const tilt = (x: number, y: number) => {
          rotateX(-y * TILT_MAX);
          rotateY(x * TILT_MAX);
          sheenX((x + 1) * 50);
          sheenY((y + 1) * 50);
          sheenOn(x === 0 && y === 0 ? 0 : 1);
        };

        const to = card.getBoundingClientRect();
        gsap
          .timeline({
            onComplete: () => {
              tiltRef.current = tilt;
              onResultEnd();
            },
          })
          .from(card, {
            x: from.left + from.width / 2 - (to.left + to.width / 2),
            y: from.top + from.height / 2 - (to.top + to.height / 2),
            scale: from.width / to.width,
            duration: RISE_DURATION,
            ease: "power2.inOut",
          })
          .from(
            [".draw-screen__reading", ".draw-screen__actions"],
            {
              autoAlpha: 0,
              y: 16,
              duration: READING_DURATION,
              ease: "power2.out",
              stagger: 0.15,
            },
            "-=0.2",
          );
        return;
      }

      const table = tableRef.current;
      if (!table) return;
      const slots = gsap.utils.toArray<HTMLElement>(
        ".draw-screen__slot",
        table,
      );

      gsap.set(slots, { xPercent: -50, yPercent: -50 });

      if (phase === "revealing") {
        if (selected === null) return;
        const slot = slots[selected];
        const card = slot.querySelector<HTMLElement>(".card");
        if (!card) return;
        const others = slots.filter((_, index) => index !== selected);
        const finish = () => {
          revealedRectRef.current = card.getBoundingClientRect();
          onRevealEnd();
        };

        // 부채꼴로 카드 펼치기
        const tableRect = table.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        gsap.set(slot, {
          transformOrigin: "50% 50%",
          left: `${((slotRect.left + slotRect.width / 2 - tableRect.left) / tableRect.width) * 100}%`,
          top: `${((slotRect.top + slotRect.height / 2 - tableRect.top) / tableRect.height) * 100}%`,
          zIndex: 1,
        });

        // 결과 화면 카드 확대
        const revealWidth = Math.min(
          tableRect.width * 0.6,
          (tableRect.height * 0.8) / 1.5,
        );
        const picked = {
          left: "50%",
          top: "50%",
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
        const fan = toTweenVars(PLACEMENTS.fanned);
        const ready = () => {
          fanRef.current = measureFan(slots[0]);
          onFanEnd();
        };
        if (reduceMotion) {
          gsap.set(slots, fan);
          gsap.delayedCall(0, ready);
          return;
        }

        const angles = PLACEMENTS.fanned.map((placement) => placement.rotation);
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

      const scatter = toTweenVars(PLACEMENTS.scattered);
      if (reduceMotion) {
        gsap.set(slots, scatter);
        gsap.delayedCall(0, onWashEnd);
        return;
      }

      const timeline = gsap.timeline({ onComplete: onWashEnd });
      if (origin) {
        const rect = table.getBoundingClientRect();
        timeline.fromTo(
          slots,
          {
            left: `${((origin.centerX - rect.left) / rect.width) * 100}%`,
            top: `${((origin.centerY - rect.top) / rect.height) * 100}%`,
            rotation: 0,
            scale: origin.width / slots[0].offsetWidth,
          },
          {
            ...scatter,
            duration: SCATTER_DURATION,
            ease: "power2.inOut",
            stagger: { each: SCATTER_STAGGER, from: "end" },
          },
        );
      } else {
        timeline.set(slots, scatter);
      }
      addWashAndGather(timeline, slots, PLACEMENTS.scattered);
    },
    { scope: screenRef, dependencies: [phase, origin] },
  );

  const slotAt = (index: number) =>
    tableRef.current?.querySelectorAll<HTMLElement>(".draw-screen__slot")[
      index
    ];

  // 카드 선택
  const hover = contextSafe((index: number | null) => {
    const previous = hoveredRef.current;
    if (previous === index) return;
    hoveredRef.current = index;

    const previousSlot = previous === null ? undefined : slotAt(previous);
    if (previousSlot) {
      gsap.set(previousSlot, { zIndex: 0 });
      gsap.to(previousSlot.firstElementChild, {
        y: 0,
        duration: POP_DURATION,
        ease: "power2.out",
      });
    }
    const slot = index === null ? undefined : slotAt(index);
    if (slot && fanRef.current) {
      gsap.set(slot, { zIndex: 1 });
      gsap.to(slot.firstElementChild, {
        y: fanRef.current.cardWidth * POP_DISTANCE,
        duration: POP_DURATION,
        ease: "power2.out",
      });
    }
  });

  // 고를 수 있는 동안 한 번만 받음
  const select = (index: number) => {
    if (!fanRef.current) return;
    fanRef.current = null;
    // 손가락을 뗀 뒤 들어오는 pointerleave가 뒤집힐 카드의 호버를 되돌리지 않게 비움
    hoveredRef.current = null;
    setSelected(index);
    onSelect();
  };

  const cardUnderPointer = (event: React.PointerEvent<HTMLElement>) => {
    const table = tableRef.current;
    const fan = fanRef.current;
    if (!table || !fan) return null;
    const rect = table.getBoundingClientRect();
    return cardAt(fan, event.clientX - rect.left, event.clientY - rect.top);
  };

  // 마우스는 올리면 튀고 누르면 선택, 손가락은 문지르는 동안 튀고 떼면 선택
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (fanRef.current) hover(cardUnderPointer(event));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const index = cardUnderPointer(event);
    if (index !== null) select(index);
    else hover(null);
  };

  // 마우스는 올리기만 해도, 손가락은 카드 위를 끄는 동안만 기울어짐(터치는 누른 동안에만 move가 옴)
  const handleTiltMove = (event: React.PointerEvent<HTMLElement>) => {
    const tilt = tiltRef.current;
    if (!tilt) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = gsap.utils.clamp(-1, 1);
    tilt(
      clamp(((event.clientX - rect.left) / rect.width) * 2 - 1),
      clamp(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  };

  const resetTilt = () => tiltRef.current?.(0, 0);

  if (phase === "result") {
    if (!result) return null;
    const { card, reading } = result;
    return (
      <div className="draw-screen draw-screen--result" ref={screenRef}>
        <Card
          faceUp
          name={card.name}
          image={card.image}
          className="draw-screen__result-card"
          onPointerMove={handleTiltMove}
          onPointerLeave={resetTilt}
          onPointerCancel={resetTilt}
        >
          <span className="draw-screen__sheen" aria-hidden="true" />
        </Card>

        <section className="draw-screen__reading">
          <h2 className="draw-screen__name">{card.nameKr}</h2>
          <ul className="draw-screen__keywords">
            {card.keywords.map((keyword) => (
              <li key={keyword}>{keyword}</li>
            ))}
          </ul>
          <p className="draw-screen__text">{reading}</p>
        </section>

        <div className="draw-screen__actions">
          <GoldButton
            variant="subtle"
            className="draw-screen__action-button"
            onClick={() => share(result)}
          >
            공유하기
          </GoldButton>
          <GoldButton className="draw-screen__action-button" onClick={onRedraw}>
            다시 뽑기
          </GoldButton>
          <p className="draw-screen__notice" aria-live="polite">
            {notice}
          </p>
        </div>
      </div>
    );
  }

  return (
    // 화면 2
    <div className={`draw-screen draw-screen--${phase}`} ref={screenRef}>
      <div
        className="draw-screen__table"
        ref={tableRef}
        onPointerDown={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => hover(null)}
        onPointerCancel={() => hover(null)}
      >
        {Array.from({ length: CARD_COUNT }, (_, index) => (
          <div
            key={index}
            className="draw-screen__slot"
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `${index + 1}번째 카드 고르기` : undefined}
            onClick={
              selectable
                ? (event) => {
                    if (event.detail === 0) select(index);
                  }
                : undefined
            }
            onFocus={
              selectable
                ? (event) => {
                    if (event.currentTarget.matches(":focus-visible"))
                      hover(index);
                  }
                : undefined
            }
            onBlur={
              selectable
                ? () => {
                    if (hoveredRef.current === index) hover(null);
                  }
                : undefined
            }
            onKeyDown={
              selectable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(index);
                    }
                  }
                : undefined
            }
          >
            <Card
              className="draw-screen__card"
              name={index === selected ? result?.card.name : undefined}
              image={index === selected ? result?.card.image : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DrawScreen;
