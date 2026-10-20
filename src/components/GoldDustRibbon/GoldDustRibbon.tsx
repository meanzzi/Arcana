import { useEffect, useRef } from "react";
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

// 레티나 화면 해상도 배율 상한. 3배 화면에서도 2배까지만 그려 성능을 지킴
const MAX_DPR = 2;

/*
  시작 화면 뒤를 가로지르는 S자 금가루 띠.
  입자 수천 개를 DOM 요소로 만들면 무거우므로, 캔버스 한 장에 그림으로 그린다.
  지금(퍼블리싱 단계)은 정지 화면이라 화면 크기가 바뀔 때만 다시 그림.
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

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      // 실제 픽셀 수는 dpr배로 키우고, 좌표계는 CSS px 그대로 쓰도록 배율을 걸어둠 → 레티나에서도 선명
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const layout = getLayout(width, height);
      // 중심선 광채는 화면 크기에 따라 모양이 바뀌므로 리사이즈 때마다 다시 만듦
      // [애니메이션 단계] 매 프레임이 아니라 여기(리사이즈)에서만 만들고 tick에서는 재사용할 것
      const glowBand = createGlowBand(layout, dpr);
      drawRibbon(
        ctx,
        layout,
        particles,
        getParticleCount(layout),
        glow,
        glowBand,
      );
    };

    // 창 크기를 끄는 동안 크기 변경이 연달아 들어오므로, 한 프레임에 한 번만 다시 그리도록 모음
    const scheduleRender = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(render);
    };

    // ResizeObserver는 관찰을 시작하자마자 한 번 호출되므로 첫 그리기도 여기서 처리됨.
    // 모바일 주소창이 접히며 높이가 바뀌는 경우도 함께 잡힘
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(canvas);

    /*
      [애니메이션 단계]
      - gsap.ticker.add(tick)로 매 프레임 각 입자의 t를 조금씩 늘린 뒤 drawRibbon을 다시 호출 → S자를 따라 흐름
      - 크기 계산(layout, 입자 수)은 tick마다 하지 말고 render(리사이즈)에서만 갱신해 재사용
      - prefers-reduced-motion 사용자는 지금처럼 정지 화면 유지
      - cleanup에서 gsap.ticker.remove(tick)
    */

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="gold-dust-ribbon" aria-hidden="true" />
  );
}

export default GoldDustRibbon;
