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

const SEED = 7;
const FLOW_LOOP = 160;
const MAX_DPR = 2;

function GoldDustRibbon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    const particles = createParticles(SEED);
    const glow = createGlowSprite();
    let frameId = 0;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

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

      if (width === 0 || height === 0) {
        glowBand = null;
        return;
      }

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      layout = getLayout(width, height);
      glowBand = createGlowBand(layout, dpr);
      count = getParticleCount(layout);
      draw();
    };

    const scheduleResize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(resize);
    };

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(canvas);

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
