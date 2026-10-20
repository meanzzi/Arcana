import { useEffect, useState } from "react";
import type { DrawPhase } from "../components/DrawScreen/DrawScreen";
import cardsData from "../data/cards.json";
import type { DrawResult, TarotCard } from "../types/card";
import { pickRandom } from "../utils/random";

const WASH_DURATION = 2000;
const CARDS: TarotCard[] = cardsData;

export type Phase = "start" | DrawPhase;

/*
  뽑기 흐름(단계 전환 + 결과 배정)을 한곳에 모은 훅.
  화면 흐름: start → scattered(워싱) → fanned(부채꼴) → result(결과) → 다시 뽑기 시 scattered부터
  애니메이션 없이 상태만 바로 바뀜. 애니메이션 단계에서 각 전환 사이에 움직임을 끼워 넣음
*/
export function useDrawFlow() {
  const [phase, setPhase] = useState<Phase>("start");
  const [result, setResult] = useState<DrawResult | null>(null);

  useEffect(() => {
    if (phase !== "scattered") return;
    const timer = window.setTimeout(() => setPhase("fanned"), WASH_DURATION);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const draw = () => setPhase("scattered");

  const select = () => {
    const card = pickRandom(CARDS);
    setResult({ card, reading: pickRandom(card.upright) });
    setPhase("result");
  };

  const redraw = () => {
    window.scrollTo(0, 0);
    setResult(null);
    setPhase("scattered");
  };

  return { phase, result, draw, select, redraw };
}
