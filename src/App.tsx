import StarField from "./components/StarField/StarField";
import StartScreen from "./components/StartScreen/StartScreen";

function App() {
  return (
    <>
      {/* 모든 화면 공통 배경 잔별. 화면이 바뀌어도 끊기지 않도록 화면 컴포넌트 바깥에 둠 */}
      <StarField />
      <StartScreen />
    </>
  );
}

export default App;
