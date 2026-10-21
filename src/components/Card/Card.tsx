import { useState, type HTMLAttributes, type ReactNode } from "react";
import "./Card.css";

// 뒷면
const BACK_IMAGE = "/images/cards/back.webp";

type CardProps = {
  // 이미지가 없을 때 임시 앞면에 보여줄 카드 이름
  name?: string;
  image?: string;
  // true면 앞면이 보이게 놓음.
  faceUp?: boolean;
  className?: string;
  // 앞면 위에 얹는 효과 레이어. 앞면 모서리 모양대로 잘림
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

function Card({
  name,
  image,
  faceUp = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`card ${faceUp ? "card--face-up" : ""} ${className}`}
      {...rest}
    >
      <CardSide side="back" src={BACK_IMAGE} />
      <CardSide key={image} side="front" src={image} label={name}>
        {children}
      </CardSide>
    </div>
  );
}

type CardSideProps = {
  side: "back" | "front";
  src?: string;
  label?: string;
  children?: ReactNode;
};

// 이미지 파일이 없거나 불러오지 못하면 회색 임시 카드로 대신함
function CardSide({ side, src, label, children }: CardSideProps) {
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
      {children}
    </div>
  );
}

export default Card;
