import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import GoldDustRibbon from "../GoldDustRibbon/GoldDustRibbon";
import type { DeckOrigin } from "../../types/draw";
import "./StartScreen.css";

const SUBTITLE = "별이 고른 오늘의 카드";
const DECK_SIZE = 5;
const TITLE_SHINE_GAP = 12;
const BREATH = 3;
const EXIT_DURATION = 0.5;

type StartScreenProps = {
  onDraw: (origin: DeckOrigin) => void;
};

function StartScreen({ onDraw }: StartScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const breathRef = useRef<gsap.core.Timeline | null>(null);
  const leavingRef = useRef(false);

  // 대기 상태: 카드 더미 숨쉬기(오라도 같은 박자로 커지고 밝아짐) + 제목 금빛 광택
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
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

  // 퇴장: 카드 더미만 남기고 나머지를 지운 뒤 뽑기 화면으로 넘김.
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
