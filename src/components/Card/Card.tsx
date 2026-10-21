import { useState } from "react";
import "./Card.css";

// 뒷면은 22장 공통. 아직 파일이 없으면 회색 임시 뒷면이 보임
const BACK_IMAGE = "/images/cards/back.webp";

type CardProps = {
  // 이미지가 없을 때 임시 앞면에 보여줄 카드 이름
  name?: string;
  image?: string;
  // true면 앞면이 보이게 놓음. 뒤집기 애니메이션은 GSAP이 .card의 rotationY를 180으로 돌림
  faceUp?: boolean;
  className?: string;
};

function Card({ name, image, faceUp = false, className = "" }: CardProps) {
  return (
    <div className={`card ${faceUp ? "card--face-up" : ""} ${className}`}>
      <CardSide side="back" src={BACK_IMAGE} />
      {/* 이미지가 바뀌면 불러오기 실패 상태도 새로 시작하도록 key로 다시 만듦 */}
      <CardSide key={image} side="front" src={image} label={name} />
    </div>
  );
}

type CardSideProps = {
  side: "back" | "front";
  src?: string;
  label?: string;
};

// 이미지 파일이 없거나 불러오지 못하면 회색 임시 카드로 대신함
function CardSide({ side, src, label }: CardSideProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`card__side card__side--${side} ${showImage ? "card__side--image" : ""}`}
    >
      {showImage ? (
        <img
          className="card__image"
          src={src}
          alt={label ?? ""}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        label && <span className="card__name">{label}</span>
      )}
    </div>
  );
}

export default Card;
