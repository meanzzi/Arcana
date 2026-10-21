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

/*
  뽑기 흐름(단계 전환 + 결과 배정)을 한곳에 모은 훅.
  화면 흐름: start → scattered(워싱) → fanned(부채꼴) → result(결과) → 다시 뽑기 시 scattered부터
  흩어진 단계·부채꼴 단계는 DrawScreen의 애니메이션이 끝났다는 신호(finishWash, finishFan)를 받아 넘어감
*/
export function useDrawFlow() {
  const [phase, setPhase] = useState<Phase>("start");
  const [result, setResult] = useState<DrawResult | null>(null);
  // 시작 화면 카드 더미 위치. 뽑기 화면 카드들이 여기서 출발해 흩어짐
  const [origin, setOrigin] = useState<DeckOrigin | null>(null);

  /*
    입력 잠금. 잠긴 동안 들어온 클릭·터치는 모두 무시.
    state가 아니라 ref인 이유: state는 다음 렌더링 때 바뀌어서, 아주 빠른 연타는 두 번째 클릭이
    아직 바뀌기 전 값을 보고 통과해 버림. ref는 바로 바뀌어서 같은 순간의 연타도 막음.
    뽑기·다시 뽑기를 누르면 잠그고, 펼치기 애니메이션이 끝나면(finishFan) 풂
  */
  const lockedRef = useRef(false);

  // 각 동작은 잠겨 있거나 자기 단계가 아니면 무시(예: 결과가 나온 뒤 부채꼴 카드 클릭이 한 번 더 들어온 경우)
  const draw = (deckOrigin: DeckOrigin) => {
    if (lockedRef.current || phase !== "start") return;
    lockedRef.current = true;
    setOrigin(deckOrigin);
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
    lockedRef.current = true;
    window.scrollTo(0, 0);
    setResult(null);
    // 다시 뽑기 때는 시작 화면 더미가 없으므로 출발점 없이 흩어진 배치에서 바로 시작
    setOrigin(null);
    setPhase("scattered");
  };

  // 아래 둘은 사용자 입력이 아니라 애니메이션 완료 신호라 잠금과 관계없이 받음
  const finishWash = () => {
    if (phase !== "scattered") return;
    setPhase("fanned");
  };

  const finishFan = () => {
    if (phase !== "fanned") return;
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
  };
}
