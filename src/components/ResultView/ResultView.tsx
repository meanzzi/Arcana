import { useRef } from "react";
import Card from "../Card/Card";
import GoldButton from "../GoldButton/GoldButton";
import { useResultAnimation } from "../../hooks/useResultAnimation";
import { useShare } from "../../hooks/useShare";
import type { DrawResult } from "../../types/card";
import "./ResultView.css";

type ResultViewProps = {
  result: DrawResult;
  from: DOMRect | null;
  dissolving: boolean;
  onResultEnd: () => void;
  onRedraw: () => void;
  onDissolveEnd: () => void;
};

function ResultView({
  result,
  from,
  dissolving,
  onResultEnd,
  onRedraw,
  onDissolveEnd,
}: ResultViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { notice, share } = useShare();
  const { tiltHandlers } = useResultAnimation({
    rootRef,
    from,
    dissolving,
    onResultEnd,
    onDissolveEnd,
  });
  const { card, reading } = result;

  return (
    <div className="result-view" ref={rootRef}>
      <Card
        faceUp
        name={card.name}
        image={card.image}
        className={`result-view__card ${dissolving ? "result-view__card--dissolving" : ""}`}
        {...tiltHandlers}
      >
        <span className="result-view__sheen" aria-hidden="true" />
        {dissolving && (
          <canvas className="result-view__dissolve" aria-hidden="true" />
        )}
      </Card>

      <section className="result-view__reading">
        <h2 className="result-view__name">{card.nameKr}</h2>
        <ul className="result-view__keywords">
          {card.keywords.map((keyword) => (
            <li key={keyword}>{keyword}</li>
          ))}
        </ul>
        <p className="result-view__text">{reading}</p>
      </section>

      <div className="result-view__actions">
        <GoldButton
          variant="subtle"
          className="result-view__action-button"
          onClick={() => share(result)}
        >
          공유하기
        </GoldButton>
        <GoldButton className="result-view__action-button" onClick={onRedraw}>
          다시 뽑기
        </GoldButton>
        <p className="result-view__notice" aria-live="polite">
          {notice}
        </p>
      </div>
    </div>
  );
}

export default ResultView;
