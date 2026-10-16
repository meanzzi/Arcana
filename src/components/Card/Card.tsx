import "./Card.css";

type CardProps = {
  // 앞면일 때 보여줄 카드 이름. 실제 이미지로 교체되면 제거될 임시 텍스트
  name?: string;
  // true면 앞면, false(기본값)면 뒷면
  faceUp?: boolean;
  className?: string;
};

// 카드 이미지가 아직 없어서 회색 박스로 앞/뒷면만 구분하는 임시 컴포넌트.
// 나중에 실제 이미지를 연결할 때 이 안쪽만 바꾸면 되도록 분리해둠.
function Card({ name, faceUp = false, className = "" }: CardProps) {
  return (
    <div className={`card ${faceUp ? "card--face" : "card--back"} ${className}`}>
      {faceUp && name && <span className="card__name">{name}</span>}
    </div>
  );
}

export default Card;
