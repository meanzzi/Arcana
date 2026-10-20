import DrawScreen, { type DrawPhase } from "./components/DrawScreen/DrawScreen";
import StarField from "./components/StarField/StarField";
import StartScreen from "./components/StartScreen/StartScreen";

/*
  [퍼블리싱용 임시] 주소 뒤 ?phase=값으로 보여줄 정지 화면을 고름.
  예: /?phase=scattered → 흩어진 상태, /?phase=fanned → 부채꼴 상태, /?phase=result → 결과 상태, 값이 없으면 시작 화면.
  기능 단계에서 버튼으로 바뀌는 상태(useState)로 교체할 예정
*/
const DRAW_PHASES: DrawPhase[] = ["scattered", "fanned", "result"];
const phaseParam = new URLSearchParams(window.location.search).get("phase");
const phase = DRAW_PHASES.find((value) => value === phaseParam);

function App() {
  return (
    <>
      <StarField />
      {phase ? <DrawScreen phase={phase} /> : <StartScreen />}
    </>
  );
}

export default App;
