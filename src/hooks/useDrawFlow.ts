import { useEffect, useRef, useState } from "react";
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

  /*
    입력 잠금. 잠긴 동안 들어온 클릭·터치는 모두 무시.
    state가 아니라 ref인 이유: state는 다음 렌더링 때 바뀌어서, 아주 빠른 연타는 두 번째 클릭이
    아직 바뀌기 전 값을 보고 통과해 버림. ref는 바로 바뀌어서 같은 순간의 연타도 막음.
    애니메이션 단계에서는 전환 애니메이션 시작 시 잠그고 onComplete에서 풂
  */
  const lockedRef = useRef(false);

  // 워싱 중에는 잠그고, 끝나서 부채꼴이 되면 풂
  useEffect(() => {
    if (phase !== "scattered") return;
    lockedRef.current = true;
    const timer = window.setTimeout(() => {
      lockedRef.current = false;
      setPhase("fanned");
    }, WASH_DURATION);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // 각 동작은 잠겨 있거나 자기 단계가 아니면 무시(예: 결과가 나온 뒤 부채꼴 카드 클릭이 한 번 더 들어온 경우)
  const draw = () => {
    if (lockedRef.current || phase !== "start") return;
    setPhase("scattered");
  };

  const select = () => {
    if (lockedRef.current || phase !== "fanned") return;
    const card = pickRandom(CARDS);
    setResult({ card, reading: pickRandom(card.upright) });
    setPhase("result");
  };

  const redraw = () => {
    if (lockedRef.current || phase !== "result") return;
    window.scrollTo(0, 0);
    setResult(null);
    setPhase("scattered");
  };

  return { phase, result, draw, select, redraw };
}
