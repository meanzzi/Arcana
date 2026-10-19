import Card from "../Card/Card";
import GoldDustRibbon from "../GoldDustRibbon/GoldDustRibbon";
import "./StartScreen.css";

// 임시 부제 문구. 최종 문구는 추후 교체
const SUBTITLE = "별이 고른 오늘의 카드";

// 화면에 쌓아 보여줄 카드 장수(실제 22장과 무관한 연출용 숫자)
const DECK_SIZE = 5;

function StartScreen() {
  return (
    // 모바일 기준 레이아웃. 데스크톱에서는 CSS의 max-width로 가운데 세로 영역만 유지되고
    // 양옆은 배경(남색)만 넓어지는 방식으로 반응형 처리됨.
    // 화면 테두리 선·모서리 장식은 미니멀한 느낌을 위해 넣지 않음
    <div className="start-screen">
      {/* 배경 S자 금가루 띠. fixed 레이어라 DOM 위치와 상관없이 화면 전체, 콘텐츠 뒤에 깔림 */}
      <GoldDustRibbon />

      <header className="start-screen__header">
        {/* 리본 배너도 이미지가 아직 없어서 위아래 금색 선으로만 표시 */}
        <div className="start-screen__ribbon">
          <h1 className="start-screen__title">Arcana of the Day</h1>
        </div>
        <p className="start-screen__subtitle">{SUBTITLE}</p>
      </header>

      <div className="start-screen__deck-area">
        {/*
          deck-wrap: 호버 감지 + 오라 영역을 담당하는 바깥 요소.
          나중에 GSAP이 .card에 직접 transform을 걸 예정이라,
          호버로 인한 이동(translateY)은 .card가 아니라 이 바깥 wrap에 적용해 충돌을 피함
        */}
        <div className="start-screen__deck-wrap">
          {/*
            오라는 3겹으로 구성: ① aura(넓은 후광) → ② aura-core(카드 바로 뒤 진한 빛)
            → ③ 카드 테두리 발광(.start-screen__deck의 drop-shadow, CSS 참고).
            빛은 가까울수록 진하고 멀수록 빠르게 옅어지므로, 넓은 빛과 좁은 빛을 겹쳐 자연스럽게 표현
          */}
          <span className="start-screen__aura" aria-hidden="true" />
          <span className="start-screen__aura-core" aria-hidden="true" />
          {/* 금색 원 두 겹. 별자리 의미 없이 순수 장식용 */}
          <span className="start-screen__rings" aria-hidden="true" />
          <div className="start-screen__deck">
            {/* 카드 더미는 뒷면만 여러 장 겹쳐서 보여줌. 각도·위치 차이는 CSS nth-child로 고정 배치 */}
            {Array.from({ length: DECK_SIZE }).map((_, index) => (
              <Card key={index} className="start-screen__deck-card" />
            ))}
          </div>
        </div>
      </div>

      <button className="start-screen__draw-button" type="button">
        {/* 호버/터치 시 차오르는 금빛 배경(::before)보다 글자가 항상 위에 오도록 분리 */}
        <span className="start-screen__draw-button-label">카드 뽑기</span>
      </button>
    </div>
  );
}

export default StartScreen;
