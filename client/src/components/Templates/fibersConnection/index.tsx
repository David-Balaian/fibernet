
import { ICable } from "src/utils/threeJSHelpers/types";
import FiberCanvas from "./canvasDraw";


const App = () => {
    const cables: ICable[] = [
        {
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)" },
                { color: "rgb(255, 165, 0)" },
                { color: "rgb(0, 128, 0)" },
                { color: "rgb(165, 42, 42)" },
                { color: "rgb(128, 128, 128)" },
                { color: "rgb(255, 255, 255)" },
                { color: "rgb(255, 0, 0)" },
                { color: "rgb(0, 0, 0)" },
                { color: "rgb(255, 255, 0)" },
                { color: "rgb(128, 0, 128)" },
                { color: "rgb(255, 192, 203)" },
                { color: "rgb(0, 255, 255)" },
                { color: "rgb(0, 0, 255)", isMarked: true },
                { color: "rgb(255, 165, 0)", isMarked: true },
                { color: "rgb(0, 128, 0)", isMarked: true },
                { color: "rgb(165, 42, 42)", isMarked: true },

            ]
        },
        {
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)" },
                { color: "rgb(255, 165, 0)" },
                { color: "rgb(0, 128, 0)" },
                { color: "rgb(165, 42, 42)" },
                { color: "rgb(128, 128, 128)" },
                { color: "rgb(255, 255, 255)" },
                { color: "rgb(255, 0, 0)" },
                { color: "rgb(0, 0, 0)" },
            ]
        },
        {
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)" },
                { color: "rgb(255, 0, 0)" },
            ]
        },
        {
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)" },
                { color: "rgb(255, 165, 0)" },
                { color: "rgb(0, 128, 0)" },
                { color: "rgb(255, 0, 0)" },
            ]
        },
    ]

    return (
        <div>
            <div style={{ margin: '0 auto', width: '100vw', height: '100vh' }}>
                    <FiberCanvas initialCables={cables} />
            </div>
        </div>
    )
}

export default App;