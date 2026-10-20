import { useEffect, useRef } from "react";
import gsap from "gsap";
import {
  createGlowBand,
  createGlowSprite,
  createParticles,
  drawRibbon,
  getLayout,
  getParticleCount,
} from "./goldDust";
import "./GoldDustRibbon.css";

// 입자 배치를 고정하는 시드. 값을 바꾸면 같은 S자 안에서 금가루 흩어진 모양만 달라짐
const SEED = 7;

// 금가루가 S자 처음부터 끝까지 한 번 흘러가는 시간(초). 클수록 느림
const FLOW_LOOP = 160;

// 레티나 화면 해상도 배율 상한. 3배 화면에서도 2배까지만 그려 성능을 지킴
const MAX_DPR = 2;

/*
  시작 화면 뒤를 가로지르는 S자 금가루 띠.
  입자 수천 개를 DOM 요소로 만들면 무거우므로, 캔버스 한 장에 그림으로 그린다.
  - 리사이즈: 캔버스 크기와 레이아웃·광채처럼 무거운 계산만 다시 함
  - 매 프레임(gsap.ticker): 계산해 둔 값으로 금가루를 조금씩 흘려서 다시 그리기만 함
*/
function GoldDustRibbon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    // 입자·빛번짐 스프라이트는 한 번만 만들어 두고, 크기가 바뀌면 그리기만 다시 함
    const particles = createParticles(SEED);
    const glow = createGlowSprite();
    let frameId = 0;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 리사이즈 때만 바뀌는 값. 매 프레임 그리기에서 재사용 (첫 리사이즈 전에는 그리지 않음)
    let layout = getLayout(canvas.clientWidth, canvas.clientHeight);
    let glowBand: HTMLCanvasElement | null = null;
    let count = getParticleCount(layout);
    const motion = { flow: 0, time: 0 };

    const draw = () => {
      if (glowBand) {
        drawRibbon(ctx, layout, particles, count, glow, glowBand, motion);
      }
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      // 실제 픽셀 수는 dpr배로 키우고, 좌표계는 CSS px 그대로 쓰도록 배율을 걸어둠 → 레티나에서도 선명
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      layout = getLayout(width, height);
      glowBand = createGlowBand(layout, dpr);
      count = getParticleCount(layout);
      draw();
    };

    // 창 크기를 끄는 동안 크기 변경이 연달아 들어오므로, 한 프레임에 한 번만 다시 계산하도록 모음
    const scheduleResize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(resize);
    };

    // ResizeObserver는 관찰을 시작하자마자 한 번 호출되므로 첫 그리기도 여기서 처리됨.
    // 모바일 주소창이 접히며 높이가 바뀌는 경우도 함께 잡힘
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(canvas);

    // 흐르기 + 일렁이기: 지난 시간만큼 경로를 따라 밀고, 물결 시각을 진행. '동작 줄이기' 사용자는 정지 화면 유지
    const tick = (time: number, deltaTime: number) => {
      motion.flow = (motion.flow + deltaTime / 1000 / FLOW_LOOP) % 1;
      motion.time = time;
      draw();
    };
    if (!reduceMotion) {
      gsap.ticker.add(tick);
    }

    return () => {
      gsap.ticker.remove(tick);
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="gold-dust-ribbon" aria-hidden="true" />
  );
}

export default GoldDustRibbon;
