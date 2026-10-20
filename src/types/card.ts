export type TarotCard = {
  number: number;
  roman: string;
  name: string;
  nameKr: string;
  image: string;
  keywords: string[];
  // 정방향 해석. 뽑을 때 하나를 랜덤으로 보여줌 (나중에 역방향을 추가할 수 있게 정방향으로 구분)
  upright: string[];
};

export type DrawResult = {
  card: TarotCard;
  reading: string;
};
