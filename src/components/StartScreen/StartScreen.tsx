import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import GoldDustRibbon from "../GoldDustRibbon/GoldDustRibbon";
import "./StartScreen.css";

// 임시 부제 문구. 최종 문구는 추후 교체
const SUBTITLE = "별이 고른 오늘의 카드";

// 화면에 쌓아 보여줄 카드 장수(실제 22장과 무관한 연출용 숫자)
const DECK_SIZE = 5;

type StartScreenProps = {
  onDraw: () => void;
};

function StartScreen({ onDraw }: StartScreenProps) {
  return (
    // 모바일 기준 레이아웃. 데스크톱에서는 CSS의 max-width로 가운데 세로 영역만 유지되고
    // 양옆은 배경(남색)만 넓어지는 방식으로 반응형 처리됨.
    <div className="start-screen">
      <GoldDustRibbon />

      <header className="start-screen__header">
        <div className="start-screen__ribbon">
          <h1 className="start-screen__title">Arcana of the Day</h1>
        </div>
        <p className="start-screen__subtitle">{SUBTITLE}</p>
      </header>

      <div className="start-screen__deck-area">
        <div className="start-screen__deck-wrap">
          <span className="start-screen__aura" aria-hidden="true" />
          <span className="start-screen__aura-core" aria-hidden="true" />
          <span className="start-screen__rings" aria-hidden="true" />
          <div className="start-screen__deck">
            {/* 카드 더미는 뒷면만 여러 장 겹쳐서 보여줌. 각도·위치 차이는 CSS nth-child로 고정 배치 */}
            {Array.from({ length: DECK_SIZE }).map((_, index) => (
              <Card key={index} className="start-screen__deck-card" />
            ))}
          </div>
        </div>
      </div>

      <GoldButton className="start-screen__draw-button" onClick={onDraw}>
        카드 뽑기
      </GoldButton>
    </div>
  );
}

export default StartScreen;
