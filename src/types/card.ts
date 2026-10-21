export type TarotCard = {
  number: number;
  roman: string;
  name: string;
  nameKr: string;
  image: string;
  keywords: string[];
  upright: string[]; // 정방향 해석. (역방향 추가 예정)
};

export type DrawResult = {
  card: TarotCard;
  reading: string;
};
