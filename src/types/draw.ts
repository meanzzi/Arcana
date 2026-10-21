export type DrawPhase =
  "scattered" | "fanned" | "revealing" | "result" | "dissolving";

// 카드 테이블(22장)이 보이는 단계
export type TablePhase = Exclude<DrawPhase, "result" | "dissolving">;

// 시작 화면 카드 더미의 화면 위치(뷰포트 기준 px). 뽑기 화면 카드들이 여기서 출발함
export type DeckOrigin = {
  centerX: number;
  centerY: number;
  width: number;
};
