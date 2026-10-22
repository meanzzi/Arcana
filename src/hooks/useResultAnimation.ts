import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { createDissolve } from "../utils/dissolve";

const RISE_DURATION = 0.8;
const READING_DURATION = 0.6;

const TILT_MAX = 10;
const TILT_FOLLOW = 0.5;

const LEAVE_DURATION = 0.4;
const DISSOLVE_DURATION = 2.6;
const MAX_PIXEL_RATIO = 2;

type ResultAnimationOptions = {
  rootRef: RefObject<HTMLDivElement>;
  // 뒤집기가 끝난 카드의 화면 위치. 결과 카드가 이 자리에서 출발해 위로 올라감
  from: DOMRect | null;
  dissolving: boolean;
  onResultEnd: () => void;
  onDissolveEnd: () => void;
};

// 셰이더에 올릴 카드 그림. 이미지가 없으면 회색 임시 앞면을 직접 그림
function cardPicture(card: HTMLElement, width: number, height: number) {
  const image = card.querySelector<HTMLImageElement>(
    ".card__side--front .card__image",
  );
  if (image?.complete && image.naturalWidth > 0) return image;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const scale = width / card.offsetWidth;
  context.fillStyle = "#5c5c66";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#c9a24a";
  context.lineWidth = 2 * scale;
  context.strokeRect(0, 0, width, height);
  context.fillStyle = "#e6d5a8";
  context.font = `${14 * scale}px "Gowun Batang", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    card.querySelector(".card__name")?.textContent ?? "",
    width / 2,
    height / 2,
  );
  return canvas;
}

// 결과 화면 등장(카드 올라오기 → 해석·버튼), 다 올라온 뒤의 금박 틸트, 다시 뽑기 때의 디졸브
export function useResultAnimation({
  rootRef,
  from,
  dissolving,
  onResultEnd,
  onDissolveEnd,
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

  useGSAP(
    () => {
      if (!dissolving) return;
      tiltRef.current = null;
      const card =
        rootRef.current?.querySelector<HTMLElement>(".result-view__card");
      const canvas = card?.querySelector<HTMLCanvasElement>(
        ".result-view__dissolve",
      );
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!card || !canvas || reduceMotion) {
        gsap.delayedCall(0, onDissolveEnd);
        return;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
      const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
      canvas.width = Math.round(card.offsetWidth * ratio);
      canvas.height = Math.round(card.offsetHeight * ratio);
      const picture = cardPicture(card, canvas.width, canvas.height);
      const dissolve = createDissolve(canvas, picture);
      if (dissolve) dissolve.draw(0);
      else
        canvas
          .getContext("2d")
          ?.drawImage(picture, 0, 0, canvas.width, canvas.height);
      const burn = { progress: 0 };

      const timeline = gsap
        .timeline({
          onComplete: () => {
            dissolve?.dispose();
            onDissolveEnd();
          },
        })
        .to(card, {
          rotationX: 0,
          rotationY: 0,
          "--sheen-on": 0,
          duration: LEAVE_DURATION,
          ease: "power2.out",
          // 아직 따라가는 중인 틸트 트윈과 겹치지 않게 끔
          overwrite: "auto",
        })
        .to(
          [".result-view__reading", ".result-view__actions"],
          {
            autoAlpha: 0,
            y: 16,
            duration: LEAVE_DURATION,
            ease: "power2.in",
          },
          0,
        );
      if (dissolve) {
        timeline.to(
          burn,
          {
            progress: 1,
            duration: DISSOLVE_DURATION,
            ease: "none",
            onUpdate: () => dissolve.draw(burn.progress),
          },
          LEAVE_DURATION / 2,
        );
      } else {
        // WebGL을 못 쓰는 환경에서는 그냥 흐려지며 사라짐
        timeline.to(
          canvas,
          { autoAlpha: 0, duration: LEAVE_DURATION },
          LEAVE_DURATION / 2,
        );
      }
      return () => dissolve?.dispose();
    },
    { scope: rootRef, dependencies: [dissolving] },
  );

  // 마우스는 올리기만 해도, 손가락은 카드를 누르거나 끄는 동안 기울어짐
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
      onPointerDown: handleTiltMove,
      onPointerMove: handleTiltMove,
      onPointerLeave: resetTilt,
      onPointerCancel: resetTilt,
    },
  };
}
