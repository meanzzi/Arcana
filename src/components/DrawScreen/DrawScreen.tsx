import Card from "../Card/Card";
import { between, createRandom } from "../../utils/random";
import "./DrawScreen.css";

/* ================= 튜닝용 상수 ================= */

/** 워싱에 쓰는 카드 장수 (뒷면이라 실제 22장과 무관) */
const CARD_COUNT = 10;
/** 배치를 매번 같게 만드는 시드. 숫자를 바꾸면 다른 모양으로 흩어짐 */
const SCATTER_SEED = 7;
/** 가운데에서 카드 중심까지 거리 범위(테이블 영역 반폭·반높이 대비 %) */
const RADIUS_MIN = 18;
const RADIUS_MAX = 62;
/** 소용돌이 방향(접선)에서 벗어나는 기울기 흔들림(deg) */
const TILT_JITTER = 30;

/* =============================================== */

type CardPlacement = {
  /** 테이블 영역 기준 카드 중심 위치(%) */
  x: number;
  y: number;
  rotation: number;
};

/*
  흩어진 상태: 테이블 위에 카드를 펼쳐놓고 휘젓는 도중의 한 장면.
  카드들이 가운데를 빙 둘러 놓이고 각자 원의 접선 방향으로 기울어져 있어서,
  정지 화면에서도 '한 방향으로 도는 흐름'이 느껴지게 함.
  시드 랜덤이라 새로고침해도 같은 배치. 애니메이션 단계에서는 GSAP이 이 위치들을 계속 바꿔 줌
*/
function createScatter(): CardPlacement[] {
  const random = createRandom(SCATTER_SEED);
  return Array.from({ length: CARD_COUNT }, (_, index) => {
    // 각도는 고르게 나누고 조금씩만 흔들어, 한쪽에 몰리지 않게 함
    const angle = (index / CARD_COUNT) * Math.PI * 2 + between(random, -0.3, 0.3);
    const radius = between(random, RADIUS_MIN, RADIUS_MAX);
    // 접선 방향 = 중심에서 바깥을 향한 각도 + 90도
    const tangent = (angle * 180) / Math.PI + 90;
    return {
      x: 50 + (Math.cos(angle) * radius) / 2,
      y: 50 + (Math.sin(angle) * radius) / 2,
      rotation: tangent + between(random, -TILT_JITTER, TILT_JITTER),
    };
  });
}

const SCATTER = createScatter();

function DrawScreen() {
  return (
    // 화면 2(뽑기+결과). 지금은 ① 흩어진 상태만 있음. 부채꼴·결과 상태는 다음 작업에서 추가
    <div className="draw-screen">
      <div className="draw-screen__table">
        {SCATTER.map((placement, index) => (
          // 위치는 감싸개(slot)에, 카드 자체 transform은 비워 둠(나중에 GSAP이 카드를 직접 다룸)
          <div
            key={index}
            className="draw-screen__slot"
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
            }}
          >
            <Card className="draw-screen__card" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DrawScreen;
