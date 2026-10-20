import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import GoldDustRibbon from "../GoldDustRibbon/GoldDustRibbon";
import "./StartScreen.css";

// 임시 부제 문구. 최종 문구는 추후 교체
const SUBTITLE = "별이 고른 오늘의 카드";

// 화면에 쌓아 보여줄 카드 장수(실제 22장과 무관한 연출용 숫자)
const DECK_SIZE = 5;

// 제목 광택이 다시 지나가기까지 쉬는 시간(초)
const TITLE_SHINE_GAP = 12;

// 숨쉬기 한 방향(올라가기 또는 내려오기) 시간(초)
const BREATH = 3;

type StartScreenProps = {
  onDraw: () => void;
};

function StartScreen({ onDraw }: StartScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null);

  // 대기 상태: 카드 더미 숨쉬기(오라도 같은 박자로 커지고 밝아짐) + 제목 금빛 광택
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // '동작 줄이기' 설정 사용자에게는 만들지 않음
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // CSS의 translate(-50%, -50%)를 GSAP이 알아듣는 값으로 바꿔 둠(안 하면 scale이 가운데 정렬을 덮어씀)
        gsap.set([".start-screen__aura", ".start-screen__aura-core"], { xPercent: -50, yPercent: -50, x: 0, y: 0 });

        gsap
          .timeline({ repeat: -1, yoyo: true, defaults: { duration: BREATH, ease: "sine.inOut" } })
          .to(".start-screen__deck", { y: -6 })
          .to(".start-screen__aura", { scale: 1.04, opacity: 0.9 }, "<")
          .to(".start-screen__aura-core", { opacity: 1 }, "<");

        // 제목 금빛 광택: 화면이 나타나고 잠깐 뒤 한 번 지나가고, 이후 TITLE_SHINE_GAP초마다 다시
        gsap.fromTo(
          ".start-screen__title",
          { backgroundPosition: "100% 0" },
          {
            backgroundPosition: "0% 0",
            duration: 2.5,
            ease: "power2.inOut",
            delay: 0.8,
            repeat: -1,
            repeatDelay: TITLE_SHINE_GAP,
          },
        );
      });
    },
    { scope: screenRef },
  );

  return (
    // 모바일 기준 레이아웃. 데스크톱에서는 CSS의 max-width로 가운데 세로 영역만 유지되고
    // 양옆은 배경(남색)만 넓어지는 방식으로 반응형 처리됨.
    <div className="start-screen" ref={screenRef}>
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
