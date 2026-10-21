import { useState } from "react";
import CardTable from "../CardTable/CardTable";
import ResultView from "../ResultView/ResultView";
import type { DrawResult } from "../../types/card";
import type { DeckOrigin, DrawPhase } from "../../types/draw";

type DrawScreenProps = {
  phase: DrawPhase;
  result: DrawResult | null;
  origin: DeckOrigin | null;
  onWashEnd: () => void;
  onFanEnd: () => void;
  onSelect: () => void;
  onRevealEnd: () => void;
  onResultEnd: () => void;
  onRedraw: () => void;
  onDissolveEnd: () => void;
};

// 화면 2. 결과 단계 전에는 카드 테이블, 결과·다시 뽑기 단계에는 결과 화면을 보여줌
function DrawScreen({
  phase,
  result,
  origin,
  onWashEnd,
  onFanEnd,
  onSelect,
  onRevealEnd,
  onResultEnd,
  onRedraw,
  onDissolveEnd,
}: DrawScreenProps) {
  // 뒤집기가 끝난 카드의 화면 위치. 결과 화면 카드가 이 자리에서 출발해 위로 올라감
  const [revealedRect, setRevealedRect] = useState<DOMRect | null>(null);

  if (phase === "result" || phase === "dissolving") {
    if (!result) return null;
    return (
      <ResultView
        result={result}
        from={revealedRect}
        onResultEnd={onResultEnd}
        dissolving={phase === "dissolving"}
        onRedraw={onRedraw}
        onDissolveEnd={onDissolveEnd}
      />
    );
  }

  return (
    <CardTable
      phase={phase}
      result={result}
      origin={origin}
      onWashEnd={onWashEnd}
      onFanEnd={onFanEnd}
      onSelect={onSelect}
      onRevealEnd={(rect) => {
        setRevealedRect(rect);
        onRevealEnd();
      }}
    />
  );
}

export default DrawScreen;
