import DrawScreen from "./components/DrawScreen/DrawScreen";
import StarField from "./components/StarField/StarField";
import StartScreen from "./components/StartScreen/StartScreen";
import { useDrawFlow } from "./hooks/useDrawFlow";

function App() {
  const { phase, result, origin, draw, select, redraw, finishWash, finishFan } =
    useDrawFlow();

  return (
    <>
      <StarField />
      {phase === "start" ? (
        <StartScreen onDraw={draw} />
      ) : (
        <DrawScreen
          phase={phase}
          result={result}
          origin={origin}
          onWashEnd={finishWash}
          onFanEnd={finishFan}
          onSelect={select}
          onRedraw={redraw}
        />
      )}
    </>
  );
}

export default App;
