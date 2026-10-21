import { useRef, useState } from "react";
import Card from "../Card/Card";
import { useFanHover } from "../../hooks/useFanHover";
import { useTableAnimation } from "../../hooks/useTableAnimation";
import type { DrawResult } from "../../types/card";
import type { DeckOrigin, TablePhase } from "../../types/draw";
import { CARD_COUNT } from "../../utils/cardLayout";
import "./CardTable.css";

type CardTableProps = {
  phase: TablePhase;
  result: DrawResult | null;
  origin: DeckOrigin | null;
  onWashEnd: () => void;
  onFanEnd: () => void;
  onSelect: () => void;
  onRevealEnd: (rect: DOMRect) => void;
};

// 카드 22장 테이블. 단계가 바뀌어도 같은 카드 요소의 위치만 GSAP이 바꿈
function CardTable({
  phase,
  result,
  origin,
  onWashEnd,
  onFanEnd,
  onSelect,
  onRevealEnd,
}: CardTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selectable = phase === "fanned";

  const fanHover = useFanHover({
    tableRef,
    onSelect: (index) => {
      setSelected(index);
      onSelect();
    },
  });

  useTableAnimation({
    tableRef,
    phase,
    origin,
    selected,
    onWashEnd,
    onFanReady: (fan) => {
      fanHover.ready(fan);
      onFanEnd();
    },
    onRevealEnd,
  });

  return (
    <div className={`card-table card-table--${phase}`}>
      <div
        className="card-table__area"
        ref={tableRef}
        {...fanHover.tableHandlers}
      >
        {Array.from({ length: CARD_COUNT }, (_, index) => (
          <div
            key={index}
            className="card-table__slot"
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `${index + 1}번째 카드 고르기` : undefined}
            {...(selectable ? fanHover.slotHandlers(index) : {})}
          >
            <Card
              className="card-table__card"
              name={index === selected ? result?.card.name : undefined}
              image={index === selected ? result?.card.image : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CardTable;
