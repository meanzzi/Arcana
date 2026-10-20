import DrawScreen from "./components/DrawScreen/DrawScreen";
import StarField from "./components/StarField/StarField";
import StartScreen from "./components/StartScreen/StartScreen";
import { useDrawFlow } from "./hooks/useDrawFlow";

function App() {
  const { phase, result, draw, select, redraw } = useDrawFlow();

  return (
    <>
      <StarField />
      {phase === "start" ? (
        <StartScreen onDraw={draw} />
      ) : (
        <DrawScreen
          phase={phase}
          result={result}
          onSelect={select}
          onRedraw={redraw}
        />
      )}
    </>
  );
}

export default App;
