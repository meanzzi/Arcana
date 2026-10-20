import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import { between, createRandom } from "../../utils/random";
import "./DrawScreen.css";

/* ================= 튜닝용 상수 ================= */

const CARD_COUNT = 22;
const SCATTER_SEED = 7;
const SCATTER_RADIUS = 92; // 가운데에서 가장 바깥 카드 중심까지 거리(테이블 영역 반폭·반높이 대비 %)
const RADIUS_JITTER = 10; // 위치·기울기 흔들림. 클수록 규칙성이 사라지고 어지러워짐
const TILT_JITTER = 30;

const FAN_SPREAD = 100; // 부채꼴 전체 펼침 각도, 맨 왼쪽 카드 -50도 ~ 맨 오른쪽 +50도.

/* =============================================== */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type DrawPhase = "scattered" | "fanned" | "result"; // 화면 2의 단계

type TablePhase = Exclude<DrawPhase, "result">;

/*
  [퍼블리싱용 임시] 결과 화면에 보여줄 카드와 해석.
  기능 단계에서 cards.json의 랜덤 배정 결과로 교체
*/
const SAMPLE_RESULT = {
  name: "The Moon",
  nameKr: "달",
  keywords: ["불안", "직관", "환상", "무의식"],
  reading:
    "눈앞의 길이 흐릿하게 보이는 날이에요. 모든 것을 당장 분명히 하려 하기보다, 마음속에서 조용히 들려오는 느낌을 믿어 보세요. 안개는 시간이 지나면 걷힙니다.",
};

type CardPlacement = {
  x: number;
  y: number;
  rotation: number;
};

/*
  흩어진 상태: 테이블 위에 카드를 펼쳐놓고 휘젓는 도중의 한 장면.
  - 위치: 황금각 배치(카드마다 황금각만큼 돌리고, 순서가 뒤일수록 바깥으로)라
    22장이 한쪽에 몰리거나 줄지어 보이지 않고 테이블 전체에 고르게 퍼짐
  - 기울기: 각자 원의 접선 방향으로 기울여, 정지 화면에서도 '한 방향으로 도는 흐름'이 느껴지게 함
  시드 랜덤이라 새로고침해도 같은 배치. 애니메이션 단계에서는 GSAP이 이 위치들을 계속 바꿔 줌
*/
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
      rotation: tangent + between(random, -TILT_JITTER, TILT_JITTER),
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

type DrawScreenProps = {
  phase: DrawPhase;
};

function DrawScreen({ phase }: DrawScreenProps) {
  if (phase === "result") {
    return (
      // 결과 상태
      <div className="draw-screen draw-screen--result">
        <Card
          faceUp
          name={SAMPLE_RESULT.name}
          className="draw-screen__result-card"
        />

        <section className="draw-screen__reading">
          <h2 className="draw-screen__name">{SAMPLE_RESULT.nameKr}</h2>
          <ul className="draw-screen__keywords">
            {SAMPLE_RESULT.keywords.map((keyword) => (
              <li key={keyword}>{keyword}</li>
            ))}
          </ul>
          <p className="draw-screen__text">{SAMPLE_RESULT.reading}</p>
        </section>

        {/* 공유하기는 보조 버튼, 다시 뽑기가 주 버튼 */}
        <div className="draw-screen__actions">
          <GoldButton variant="subtle" className="draw-screen__action-button">
            공유하기
          </GoldButton>
          <GoldButton className="draw-screen__action-button">
            다시 뽑기
          </GoldButton>
        </div>
      </div>
    );
  }

  return (
    // 화면 2(뽑기+결과). 단계가 바뀌어도 같은 카드 22장(같은 요소)의 위치만 바뀌는 구조라,
    // 애니메이션 단계에서 흩어진 상태 → 부채꼴로 자연스럽게 이어 움직일 수 있음
    <div className={`draw-screen draw-screen--${phase}`}>
      <div className="draw-screen__table">
        {PLACEMENTS[phase].map((placement, index) => (
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
