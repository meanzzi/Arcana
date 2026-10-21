import DrawScreen from "./components/DrawScreen/DrawScreen";
import StarField from "./components/StarField/StarField";
import StartScreen from "./components/StartScreen/StartScreen";
import { useDrawFlow } from "./hooks/useDrawFlow";

function App() {
  const flow = useDrawFlow();

  return (
    <>
      <StarField />
      {flow.phase === "start" ? (
        <StartScreen onDraw={flow.draw} />
      ) : (
        <DrawScreen
          phase={flow.phase}
          result={flow.result}
          origin={flow.origin}
          onWashEnd={flow.finishWash}
          onFanEnd={flow.finishFan}
          onSelect={flow.select}
          onRevealEnd={flow.finishReveal}
          onResultEnd={flow.finishResult}
          onRedraw={flow.redraw}
          onDissolveEnd={flow.finishDissolve}
        />
      )}
    </>
  );
}

export default App;
