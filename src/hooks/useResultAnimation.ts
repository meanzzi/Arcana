import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const RISE_DURATION = 0.8;
const READING_DURATION = 0.6;

const TILT_MAX = 10;
const TILT_FOLLOW = 0.5;

type ResultAnimationOptions = {
  rootRef: RefObject<HTMLDivElement>;
  // 뒤집기가 끝난 카드의 화면 위치. 결과 카드가 이 자리에서 출발해 위로 올라감
  from: DOMRect | null;
  onResultEnd: () => void;
};

// 결과 화면 등장(카드 올라오기 → 해석·버튼)과, 다 올라온 뒤의 금박 틸트
export function useResultAnimation({
  rootRef,
  from,
  onResultEnd,
}: ResultAnimationOptions) {
  // 결과 카드가 다 올라온 뒤에만 값이 있음
  const tiltRef = useRef<((x: number, y: number) => void) | null>(null);

  useGSAP(
    () => {
      const card =
        rootRef.current?.querySelector<HTMLElement>(".result-view__card");
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
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
          [".result-view__reading", ".result-view__actions"],
          {
            autoAlpha: 0,
            y: 16,
            duration: READING_DURATION,
            ease: "power2.out",
            stagger: 0.15,
          },
          "-=0.2",
        );
    },
    { scope: rootRef },
  );

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

  return {
    tiltHandlers: {
      onPointerMove: handleTiltMove,
      onPointerLeave: resetTilt,
      onPointerCancel: resetTilt,
    },
  };
}
