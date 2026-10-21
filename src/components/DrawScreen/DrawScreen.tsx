import { useRef } from "react";
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

// 워싱: 휘젓는 횟수, 한 번 휘젓는 시간(초), 한 번에 다 같이 도는 각도(라디안)와 카드별 흔들림
const WASH_ROUNDS = 3;
const WASH_STEP = 0.8;
const WASH_SWIRL = 0.5;
const WASH_SWIRL_JITTER = 0.35;
// 카드마다 출발을 0~이 값(초)만큼 늦춰서 22장이 한꺼번에 움직이는 기계적인 느낌을 줄임
const WASH_DELAY_JITTER = 0.2;

const GATHER_DURATION = 0.8;

// 펼치기: 모인 더미를 왼쪽 끝으로 옮기는 시간, 왼쪽 끝에서 오른쪽 끝까지 쓸어 펼치는 시간(초)
const FAN_SHIFT_DURATION = 0.5;
const FAN_SWEEP_DURATION = 1.2;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type DrawPhase = "scattered" | "fanned" | "result";

export type DeckOrigin = {
  centerX: number;
  centerY: number;
  width: number;
};

type TablePhase = Exclude<DrawPhase, "result">;

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
      // 정지 화면에선 똑같아 보이지만, 안 바꾸면 더미에서 흩어질 때 카드가 몇 바퀴씩 돌아 버림
      rotation: gsap.utils.wrap(
        -180,
        180,
        tangent + between(random, -TILT_JITTER, TILT_JITTER),
      ),
    };
  });
}

/*
  부채꼴 상태: 모든 카드가 같은 자리에 겹쳐 있고 각도만 다름.
  회전 중심(transform-origin)을 카드 위쪽 한 점으로 옮겨 두어서(CSS 참고),
  각도만 바꿔도 위 한 점을 축으로 좌우 대칭으로 펼쳐짐.
  축이 위에 있으면 +각도가 카드를 왼쪽으로 보내므로, 왼쪽 카드(앞 순서)부터 +50도 → -50도로 줌.
  DOM 순서상 뒤 카드가 위에 겹치므로 오른쪽 카드가 왼쪽 카드 위에 올라감
*/
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

/*
  워싱 → 모으기를 타임라인 뒤에 이어 붙임.
  - 워싱: 카드마다 가운데 기준 각도·거리를 들고 있다가, 한 번 휘저을 때마다 모두 같은 방향으로
    WASH_SWIRL만큼 돌고(전체가 한 방향으로 도는 흐름) 거리·기울기는 무작위로 바뀜.
    기울기는 접선 방향을 따르되, 직전 기울기에서 가까운 쪽으로만 돌게 해서 카드가 빙글 돌지 않게 함
  - 모으기: 가운데로 모이며 기울기는 가장 가까운 360도 배수로 맞춤(보이는 모양은 0도와 같음).
    끝나면 0도로 바꿔 두어서 부채꼴이 0도부터 자연스럽게 펼쳐짐
  매번 달라야 하는 움직임이라 시드 랜덤이 아니라 Math.random 사용
*/
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

type DrawScreenProps = {
  phase: DrawPhase;
  result: DrawResult | null; // 결과 단계에서만 값이 있음
  origin: DeckOrigin | null; // 시작 화면에서 넘어왔을 때만 값이 있음(다시 뽑기는 null)
  onWashEnd: () => void; // 워싱·모으기가 끝났을 때(부채꼴 단계로 넘김)
  onFanEnd: () => void; // 펼치기가 끝났을 때(카드를 고를 수 있게 잠금 해제)
  onSelect: () => void; // 부채꼴에서 카드 한 장을 골랐을 때
  onRedraw: () => void;
};

function DrawScreen({
  phase,
  result,
  origin,
  onWashEnd,
  onFanEnd,
  onSelect,
  onRedraw,
}: DrawScreenProps) {
  // 카드를 고를 수 있는 건 부채꼴 단계뿐
  const selectable = phase === "fanned";
  const { notice, share } = useShare();
  const screenRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  /*
    카드 위치·기울기는 GSAP이 혼자 맡음(인라인 style로 같이 주면 React가 다시 그릴 때 GSAP 값을 덮어씀).
    left/top은 테이블 기준 %라 화면 크기가 바뀌어도 배치가 따라감.
    - 흩어진 단계: (시작 화면에서 왔다면) 더미 자리에서 흩어짐 → 워싱 → 가운데로 모으기 → onWashEnd
    - 부채꼴 단계: 모인 더미를 왼쪽 끝으로 옮긴 뒤 오른쪽으로 좌르륵 펼침 → onFanEnd
    부채꼴의 회전축(transform-origin)은 부채꼴 단계 CSS 클래스가 바꾸는데, 그 순간 카드는 모여서
    0도라 축이 바뀌어도 모양이 그대로임
  */
  useGSAP(
    () => {
      const table = tableRef.current;
      if (!table) return;
      const slots = gsap.utils.toArray<HTMLElement>(
        ".draw-screen__slot",
        table,
      );

      // CSS의 translate(-50%, -50%)에 해당. 슬롯 가운데가 left/top 지점에 오게 함
      gsap.set(slots, { xPercent: -50, yPercent: -50 });

      // '동작 줄이기' 사용자에게는 움직임 없이 배치만 바꾸고 바로 다음 단계로.
      // 화면을 그리는 도중에 상태를 바꾸지 않도록 delayedCall로 한 박자 뒤에 알림
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (phase === "fanned") {
        const fan = toTweenVars(PLACEMENTS.fanned);
        if (reduceMotion) {
          gsap.set(slots, fan);
          gsap.delayedCall(0, onFanEnd);
          return;
        }
        /*
          실제 리더처럼 한쪽으로 좌르륵 펼침: '손' 각도 하나만 움직이고 카드는 그 손을 따라감.
          ① 모인 더미를 통째로 부채꼴 왼쪽 끝으로 옮김
          ② 손이 오른쪽 끝까지 쓸고 지나가며, 각 카드는 자기 자리에 닿으면 거기 남음
             (자리 각도와 손 각도 중 덜 간 쪽 = 큰 값). 맨 위 카드(오른쪽 끝)가 끝까지 손에 붙어 감
        */
        const angles = PLACEMENTS.fanned.map((placement) => placement.rotation);
        const setRotations = slots.map((slot) =>
          gsap.quickSetter(slot, "rotation", "deg"),
        );
        const hand = { angle: 0 };
        gsap
          .timeline({ onComplete: onFanEnd })
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
        // 22장을 더미 자리·크기로 겹쳐 놓고 출발. 위쪽 카드(DOM 뒤쪽)부터 떠남
        const rect = table.getBoundingClientRect();
        timeline.fromTo(
          slots,
          {
            left: `${((origin.centerX - rect.left) / rect.width) * 100}%`,
            top: `${((origin.centerY - rect.top) / rect.height) * 100}%`,
            rotation: 0,
            // 시작 화면 더미와 뽑기 화면 카드의 크기가 달라서 더미 크기로 맞춰 출발
            scale: origin.width / slots[0].offsetWidth,
          },
          {
            ...scatter,
            duration: SCATTER_DURATION,
            // 출발도 천천히 하도록 inOut(power3.out은 처음에 너무 확 튀어 나감)
            ease: "power2.inOut",
            stagger: { each: SCATTER_STAGGER, from: "end" },
          },
        );
      } else {
        // 다시 뽑기: 출발할 더미가 없으므로 흩어진 배치에서 바로 워싱 시작
        timeline.set(slots, scatter);
      }
      addWashAndGather(timeline, slots, PLACEMENTS.scattered);
    },
    // onWashEnd·onFanEnd는 렌더링마다 새로 만들어지는 함수라 넣지 않음(넣으면 다시 그릴 때마다 애니메이션이 처음부터 재시작)
    { scope: screenRef, dependencies: [phase, origin] },
  );

  if (phase === "result") {
    if (!result) return null;
    const { card, reading } = result;
    return (
      <div className="draw-screen draw-screen--result" ref={screenRef}>
        <Card faceUp name={card.name} className="draw-screen__result-card" />

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
          {/* 복사 결과 안내. aria-live라 화면 낭독기도 읽어 줌 */}
          <p className="draw-screen__notice" aria-live="polite">
            {notice}
          </p>
        </div>
      </div>
    );
  }

  return (
    // 화면 2(뽑기+결과). 단계가 바뀌어도 같은 카드 22장(같은 요소)의 위치만 바뀌는 구조라,
    // 애니메이션 단계에서 흩어진 상태 → 부채꼴로 자연스럽게 이어 움직일 수 있음
    <div className={`draw-screen draw-screen--${phase}`} ref={screenRef}>
      <div className="draw-screen__table" ref={tableRef}>
        {Array.from({ length: CARD_COUNT }, (_, index) => (
          // 위치는 감싸개(slot)에(GSAP이 지정), 카드 자체 transform은 비워 둠(호버·뒤집기용)
          // 고를 수 있을 때만 버튼 역할(키보드 Tab·Enter로도 선택 가능).
          // 단계마다 요소 종류를 바꾸면 카드가 새로 만들어져 애니메이션이 끊기므로 div 그대로 두고 속성만 바꿈
          <div
            key={index}
            className="draw-screen__slot"
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `${index + 1}번째 카드 고르기` : undefined}
            onClick={selectable ? onSelect : undefined}
            onKeyDown={
              selectable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect();
                    }
                  }
                : undefined
            }
          >
            <Card className="draw-screen__card" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DrawScreen;
