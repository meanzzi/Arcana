import { useRef, useState } from "react";
import type { DeckOrigin, DrawPhase } from "../types/draw";
import cardsData from "../data/cards.json";
import type { DrawResult, TarotCard } from "../types/card";
import { pickRandom } from "../utils/random";

const CARDS: TarotCard[] = cardsData;

// 뒤집는 순간 빈 앞면이 보이지 않게, 워싱이 도는 동안 22장 앞면을 미리 불러 둠
function preloadFronts() {
  CARDS.forEach((card) => {
    new Image().src = card.image;
  });
}

export type Phase = "start" | DrawPhase;

//화면 흐름: start → scattered(워싱) → fanned(부채꼴) → revealing(뒤집기) → result(결과) → 다시 뽑기
export function useDrawFlow() {
  const [phase, setPhase] = useState<Phase>("start");
  const [result, setResult] = useState<DrawResult | null>(null);
  const [origin, setOrigin] = useState<DeckOrigin | null>(null);
  // 입력 잠금. 잠긴 동안 들어온 클릭·터치는 모두 무시. -> ref인 이유: ref는 바로 바뀌어서 같은 순간의 연타도 막음.
  const lockedRef = useRef(false);

  const draw = (deckOrigin: DeckOrigin) => {
    if (lockedRef.current || phase !== "start") return;
    lockedRef.current = true;
    preloadFronts();
    setOrigin(deckOrigin);
    setPhase("scattered");
  };

  const select = () => {
    if (lockedRef.current || phase !== "fanned") return;
    lockedRef.current = true;
    const card = pickRandom(CARDS);
    setResult({ card, reading: pickRandom(card.upright) });
    setPhase("revealing");
  };

  const redraw = () => {
    if (lockedRef.current || phase !== "result") return;
    lockedRef.current = true;
    window.scrollTo(0, 0);
    setResult(null);
    setOrigin(null);
    setPhase("scattered");
  };

  const finishWash = () => {
    if (phase !== "scattered") return;
    setPhase("fanned");
  };

  const finishFan = () => {
    if (phase !== "fanned") return;
    lockedRef.current = false;
  };

  const finishReveal = () => {
    if (phase !== "revealing") return;
    setPhase("result");
  };

  const finishResult = () => {
    if (phase !== "result") return;
    lockedRef.current = false;
  };

  return {
    phase,
    result,
    origin,
    draw,
    select,
    redraw,
    finishWash,
    finishFan,
    finishReveal,
    finishResult,
  };
}
