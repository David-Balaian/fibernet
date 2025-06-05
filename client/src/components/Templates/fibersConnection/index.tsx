
import { ICable } from "src/utils/threeJSHelpers/types";
import FiberCanvas from "./canvasDraw";
import OpticalCanvas3D from "./three_fiber";
import OpticalCableVisualizer from "./threeJS";
import { v4 } from "uuid";
import { useState } from "react";


const App = () => {

    const [visualization, setVisualization] = useState<"2D" | "3D">("2D")

    const cable1ID = v4();
    const cable2ID = v4();
    const cable3ID = v4();
    const cable4ID = v4();
    const cable5ID = v4();
    const cables: ICable[] = [
        {
            id: cable1ID,
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)", id: "1", cableId: cable1ID },
                { color: "rgb(255, 165, 0)", id: "2", cableId: cable1ID },
                { color: "rgb(0, 128, 0)", id: "3", cableId: cable1ID },
                { color: "rgb(165, 42, 42)", id: "4", cableId: cable1ID },
                { color: "rgb(128, 128, 128)", id: "5", cableId: cable1ID },
                { color: "rgb(255, 255, 255)", id: "6", cableId: cable1ID },
                { color: "rgb(255, 0, 0)", id: "7", cableId: cable1ID },
                { color: "rgb(0, 0, 0)", id: "8", cableId: cable1ID },
                { color: "rgb(255, 255, 0)", id: "9", cableId: cable1ID },
                { color: "rgb(128, 0, 128)", id: "10", cableId: cable1ID },
                { color: "rgb(255, 192, 203)", id: "11", cableId: cable1ID },
                { color: "rgb(0, 255, 255)", id: "12", cableId: cable1ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "13", cableId: cable1ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "14", cableId: cable1ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "15", cableId: cable1ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "16", cableId: cable1ID },

            ]
        },
        {
            id: cable2ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "17", cableId: cable2ID },
                { color: "rgb(255, 165, 0)", id: "18", cableId: cable2ID },
                { color: "rgb(0, 128, 0)", id: "19", cableId: cable2ID },
                { color: "rgb(165, 42, 42)", id: "20", cableId: cable2ID },
                { color: "rgb(128, 128, 128)", id: "21", cableId: cable2ID },
                { color: "rgb(255, 255, 255)", id: "22", cableId: cable2ID },
                { color: "rgb(255, 0, 0)", id: "23", cableId: cable2ID },
                { color: "rgb(0, 0, 0)", id: "24", cableId: cable2ID },
                { color: "rgb(255, 255, 0)", id: "25", cableId: cable2ID },
                { color: "rgb(128, 0, 128)", id: "26", cableId: cable2ID },
                { color: "rgb(255, 192, 203)", id: "27", cableId: cable2ID },
                { color: "rgb(0, 255, 255)", id: "28", cableId: cable2ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "29", cableId: cable2ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "30", cableId: cable2ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "31", cableId: cable2ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "32", cableId: cable2ID },

            ]
        },
        {
            id: cable3ID,
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)", id: "33", cableId: cable3ID },
                { color: "rgb(255, 165, 0)", id: "34", cableId: cable3ID },
                { color: "rgb(0, 128, 0)", id: "35", cableId: cable3ID },
                { color: "rgb(165, 42, 42)", id: "36", cableId: cable3ID },
                { color: "rgb(128, 128, 128)", id: "37", cableId: cable3ID },
                { color: "rgb(255, 255, 255)", id: "38", cableId: cable3ID },
                { color: "rgb(255, 0, 0)", id: "39", cableId: cable3ID },
                { color: "rgb(0, 0, 0)", id: "40", cableId: cable3ID },
            ]
        },
        {
            id: cable4ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "41", cableId: cable4ID },
                { color: "rgb(255, 0, 0)", id: "42", cableId: cable4ID },
            ]
        },
        {
            id: cable5ID,
            type: "out", 
            tubes: [
                { color: "rgb(0, 0, 255)", id: "53", cableId: cable5ID },
                { color: "rgb(255, 165, 0)", id: "54", cableId: cable5ID },
                { color: "rgb(0, 128, 0)", id: "55", cableId: cable5ID },
                { color: "rgb(255, 0, 0)", id: "56", cableId: cable5ID },
            ],
            fibers: [
                { color: "rgb(0, 0, 255)", id: "43", cableId: cable5ID, tubeId: "53" },
                { color: "rgb(255, 165, 0)", id: "44", cableId: cable5ID, tubeId: "54" },
                { color: "rgb(0, 128, 0)", id: "45", cableId: cable5ID, tubeId: "54" },
                { color: "rgb(255, 0, 0)", id: "46", cableId: cable5ID, tubeId: "53" },
            ]
        },
    ]

    return (
        <div style={{ position: 'relative' }}>
            <span>
                <button onClick={()=>{setVisualization('2D')}}>2D</button>
                <button onClick={()=>{setVisualization('3D')}}>3D</button>
            </span>
            <div style={{ margin: '0 auto', width: '100vw', height: '100vh' }}>
                {visualization === "2D" ? <FiberCanvas initialCables={cables} /> : <OpticalCableVisualizer cables={cables} />}
            </div>
        </div>
    )
}

export default App;