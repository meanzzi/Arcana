import { useEffect, useRef } from "react";
import { between, createRandom } from "../../utils/random";
import "./StarField.css";

/* ================= 튜닝용 상수 ================= */

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

/* =============================================== */

const SEED = 21;
const MAX_DPR = 2;

/*
  화면 전체에 흩뿌린 아주 작은 잔별.
  움직이지 않는 정적 배경이라 화면 크기가 바뀔 때만 한 번 그리고 그대로 둔다
  (매 프레임 다시 그리는 캔버스가 아니므로, 이 캔버스 자체가 '한 번 그려 재사용하는' 레이어 역할).
  다른 화면(뽑기·결과)에서도 배경이 이어지도록 App 레벨에 둠.

  [애니메이션 단계] 별이 아주 느리게 흐르게 하려면 다시 그리지 말고
  이 캔버스(또는 두 장을 이어 붙인 레이어)를 transform으로 옮기는 방식으로 할 것
*/
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
