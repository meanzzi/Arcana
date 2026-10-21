import { useEffect, useRef } from "react";
import { between, createRandom } from "../../utils/random";
import "./StarField.css";

const AREA_PER_STAR = 1800;
const STAR_SIZE_MIN = 0.5;
const STAR_SIZE_MAX = 1.5;
const STAR_ALPHA_MIN = 0.2;
const STAR_ALPHA_MAX = 0.7;

const BRIGHT_RATIO = 0.05;
const BRIGHT_SIZE_MIN = 1.5;
const BRIGHT_SIZE_MAX = 2;
const BRIGHT_ALPHA_MIN = 0.8;
const BRIGHT_ALPHA_MAX = 1;
const BRIGHT_HALO_SCALE = 3;
const BRIGHT_HALO_ALPHA = 0.15;
const STAR_COLORS = ["#FFFFFF", "#F3DFA2"];

const SEED = 21;
const MAX_DPR = 2;

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    let frameId = 0;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const random = createRandom(SEED);
      const count = Math.round((width * height) / AREA_PER_STAR);
      for (let i = 0; i < count; i += 1) {
        const x = random() * width;
        const y = random() * height;
        ctx.fillStyle = STAR_COLORS[Math.floor(random() * STAR_COLORS.length)];

        if (random() < BRIGHT_RATIO) {
          const size = between(random, BRIGHT_SIZE_MIN, BRIGHT_SIZE_MAX);
          const alpha = between(random, BRIGHT_ALPHA_MIN, BRIGHT_ALPHA_MAX);

          ctx.globalAlpha = alpha * BRIGHT_HALO_ALPHA;
          ctx.beginPath();
          ctx.arc(x, y, (size / 2) * BRIGHT_HALO_SCALE, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const roll = random();
        const size =
          STAR_SIZE_MIN + (STAR_SIZE_MAX - STAR_SIZE_MIN) * roll * roll;
        ctx.globalAlpha = between(random, STAR_ALPHA_MIN, STAR_ALPHA_MAX);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const scheduleRender = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-field" aria-hidden="true" />;
}

export default StarField;
