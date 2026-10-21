import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import GoldDustRibbon from "../GoldDustRibbon/GoldDustRibbon";
import type { DeckOrigin } from "../DrawScreen/DrawScreen";
import "./StartScreen.css";

// 임시 부제 문구. 최종 문구는 추후 교체
const SUBTITLE = "별이 고른 오늘의 카드";

// 화면에 쌓아 보여줄 카드 장수(실제 22장과 무관한 연출용 숫자)
const DECK_SIZE = 5;

// 제목 광택이 다시 지나가기까지 쉬는 시간(초)
const TITLE_SHINE_GAP = 12;

// 숨쉬기 한 방향(올라가기 또는 내려오기) 시간(초)
const BREATH = 3;

// '카드 뽑기'를 누른 뒤 제목·버튼 등이 사라지는 시간(초)
const EXIT_DURATION = 0.5;

type StartScreenProps = {
  // 퇴장이 끝났을 때 카드 더미의 화면 위치를 넘겨줌. 뽑기 화면 카드 22장이 이 자리에서 출발함
  onDraw: (origin: DeckOrigin) => void;
};

function StartScreen({ onDraw }: StartScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const breathRef = useRef<gsap.core.Timeline | null>(null);
  // 퇴장 중 버튼 연타 방지. 퇴장이 끝나야 뽑기 흐름(useDrawFlow)으로 넘어가므로 그 전까지는 여기서 막음
  const leavingRef = useRef(false);

  // 대기 상태: 카드 더미 숨쉬기(오라도 같은 박자로 커지고 밝아짐) + 제목 금빛 광택
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // '동작 줄이기' 설정 사용자에게는 만들지 않음
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // CSS의 translate(-50%, -50%)를 GSAP이 알아듣는 값으로 바꿔 둠(안 하면 scale이 가운데 정렬을 덮어씀)
        gsap.set([".start-screen__aura", ".start-screen__aura-core"], {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
        });

        breathRef.current = gsap
          .timeline({
            repeat: -1,
            yoyo: true,
            defaults: { duration: BREATH, ease: "sine.inOut" },
          })
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

  /*
    퇴장: 카드 더미만 남기고 나머지를 지운 뒤 뽑기 화면으로 넘김.
    - 제목은 위로, 버튼은 아래로 살짝 밀리며 사라지고 금가루 띠·오라도 함께 사라짐
    - 더미는 숨쉬기를 멈추고 제자리로 내려오며, 비스듬히 겹쳐 있던 카드들이 가지런히 모임.
      뽑기 화면은 기울기 없이 겹친 22장에서 출발하므로, 여기서 모양을 맞춰 둬야 바뀌는 순간이 안 보임
  */
  const { contextSafe } = useGSAP({ scope: screenRef });
  const handleDraw = contextSafe(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    breathRef.current?.pause();

    const finish = () => {
      const deck = deckRef.current;
      if (!deck) return;
      const rect = deck.getBoundingClientRect();
      onDraw({
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        width: rect.width,
      });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    gsap
      .timeline({
        defaults: { duration: EXIT_DURATION, ease: "power2.inOut" },
        onComplete: finish,
      })
      .to(".start-screen__header", { y: -16, autoAlpha: 0 })
      .to(".start-screen__draw-button", { y: 16, autoAlpha: 0 }, "<")
      .to(
        [
          ".gold-dust-ribbon",
          ".start-screen__aura",
          ".start-screen__aura-core",
          ".start-screen__rings",
        ],
        { autoAlpha: 0 },
        "<",
      )
      .to(
        ".start-screen__deck",
        { y: 0, boxShadow: "0 0 0px 0px rgba(232, 199, 122, 0)" },
        "<",
      )
      .to(".start-screen__deck-card", { x: 0, y: 0, rotation: 0 }, "<");
  });

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
          <div className="start-screen__deck" ref={deckRef}>
            {/* 카드 더미는 뒷면만 여러 장 겹쳐서 보여줌. 각도·위치 차이는 CSS nth-child로 고정 배치 */}
            {Array.from({ length: DECK_SIZE }).map((_, index) => (
              <Card key={index} className="start-screen__deck-card" />
            ))}
          </div>
        </div>
      </div>

      <GoldButton className="start-screen__draw-button" onClick={handleDraw}>
        카드 뽑기
      </GoldButton>
    </div>
  );
}

export default StartScreen;
