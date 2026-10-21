import { useRef, useState } from "react";
import type {
  DeckOrigin,
  DrawPhase,
} from "../components/DrawScreen/DrawScreen";
import cardsData from "../data/cards.json";
import type { DrawResult, TarotCard } from "../types/card";
import { pickRandom } from "../utils/random";

const CARDS: TarotCard[] = cardsData;

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
