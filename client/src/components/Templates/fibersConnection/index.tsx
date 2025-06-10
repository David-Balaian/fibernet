
import { ICable } from "src/utils/threeJSHelpers/types";
import FiberCanvas from "./canvasDraw";
import OpticalCanvas3D from "./three_fiber";
import OpticalCableVisualizer from "./threeJS";
import { v4 } from "uuid";
import { useState } from "react";
import { Splitter } from "src/utils/types";


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
                { color: "rgb(0, 0, 255)", id: "1", parentId: cable1ID },
                { color: "rgb(255, 165, 0)", id: "2", parentId: cable1ID },
                { color: "rgb(0, 128, 0)", id: "3", parentId: cable1ID },
                { color: "rgb(165, 42, 42)", id: "4", parentId: cable1ID },
                { color: "rgb(128, 128, 128)", id: "5", parentId: cable1ID },
                { color: "rgb(255, 255, 255)", id: "6", parentId: cable1ID },
                { color: "rgb(255, 0, 0)", id: "7", parentId: cable1ID },
                { color: "rgb(0, 0, 0)", id: "8", parentId: cable1ID },
                { color: "rgb(255, 255, 0)", id: "9", parentId: cable1ID },
                { color: "rgb(128, 0, 128)", id: "10", parentId: cable1ID },
                { color: "rgb(255, 192, 203)", id: "11", parentId: cable1ID },
                { color: "rgb(0, 255, 255)", id: "12", parentId: cable1ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "13", parentId: cable1ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "14", parentId: cable1ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "15", parentId: cable1ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "16", parentId: cable1ID },

            ]
        },
        {
            id: cable2ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "17", parentId: cable2ID },
                { color: "rgb(255, 165, 0)", id: "18", parentId: cable2ID },
                { color: "rgb(0, 128, 0)", id: "19", parentId: cable2ID },
                { color: "rgb(165, 42, 42)", id: "20", parentId: cable2ID },
                { color: "rgb(128, 128, 128)", id: "21", parentId: cable2ID },
                { color: "rgb(255, 255, 255)", id: "22", parentId: cable2ID },
                { color: "rgb(255, 0, 0)", id: "23", parentId: cable2ID },
                { color: "rgb(0, 0, 0)", id: "24", parentId: cable2ID },
                { color: "rgb(255, 255, 0)", id: "25", parentId: cable2ID },
                { color: "rgb(128, 0, 128)", id: "26", parentId: cable2ID },
                { color: "rgb(255, 192, 203)", id: "27", parentId: cable2ID },
                { color: "rgb(0, 255, 255)", id: "28", parentId: cable2ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "29", parentId: cable2ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "30", parentId: cable2ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "31", parentId: cable2ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "32", parentId: cable2ID },

            ]
        },
        {
            id: cable3ID,
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)", id: "33", parentId: cable3ID },
                { color: "rgb(255, 165, 0)", id: "34", parentId: cable3ID },
                { color: "rgb(0, 128, 0)", id: "35", parentId: cable3ID },
                { color: "rgb(165, 42, 42)", id: "36", parentId: cable3ID },
                { color: "rgb(128, 128, 128)", id: "37", parentId: cable3ID },
                { color: "rgb(255, 255, 255)", id: "38", parentId: cable3ID },
                { color: "rgb(255, 0, 0)", id: "39", parentId: cable3ID },
                { color: "rgb(0, 0, 0)", id: "40", parentId: cable3ID },
            ]
        },
        {
            id: cable4ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "41", parentId: cable4ID },
                { color: "rgb(255, 0, 0)", id: "42", parentId: cable4ID },
            ]
        },
        {
            id: cable5ID,
            type: "out",
            tubes: [
                { color: "rgb(0, 0, 255)", id: "53", parentId: cable5ID },
                { color: "rgb(255, 165, 0)", id: "54", parentId: cable5ID },
                { color: "rgb(0, 128, 0)", id: "55", parentId: cable5ID },
                { color: "rgb(255, 0, 0)", id: "56", parentId: cable5ID },
            ],
            fibers: [
                { color: "rgb(0, 0, 255)", id: "43", parentId: cable5ID, tubeId: "53" },
                { color: "rgb(255, 165, 0)", id: "44", parentId: cable5ID, tubeId: "54" },
                { color: "rgb(0, 128, 0)", id: "45", parentId: cable5ID, tubeId: "54" },
                { color: "rgb(255, 0, 0)", id: "46", parentId: cable5ID, tubeId: "53" },
            ]
        },
    ]

    const splitter1Id: string = v4();
    const splitter2Id: string = v4();
    const splitter3Id: string = v4();



    const splitters: Splitter[] = [
        {
            name: "1/4",
            id: splitter1Id,
            inputs: [{ id: "88", parentId: splitter1Id }],
            outputs: [{ id: "89", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "61", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "60", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "61", parentId: splitter1Id, color: "rgb(255, 0, 0)" }],
        },
        {
            name: "1/8",
            id: splitter2Id,
            inputs: [{ id: "100", parentId: splitter2Id }],
            outputs: [
                { color: "rgb(0, 0, 255)", id: "90", parentId: splitter2Id },
                { color: "rgb(255, 165, 0)", id: "91", parentId: splitter2Id },
                { color: "rgb(0, 128, 0)", id: "92", parentId: splitter2Id },
                { color: "rgb(165, 42, 42)", id: "93", parentId: splitter2Id },
                { color: "rgb(128, 128, 128)", id: "94", parentId: splitter2Id },
                { color: "rgb(255, 255, 255)", id: "95", parentId: splitter2Id },
                { color: "rgb(255, 0, 0)", id: "96", parentId: splitter2Id },
                { color: "rgb(0, 0, 0)", id: "97", parentId: splitter2Id },
            ],
        },
    ]

    const commutators = [
        {
            name: "OLT",
            id: splitter3Id,
            inputs: [
                { id: "300", parentId: splitter3Id },
                { id: "301", parentId: splitter3Id },
                { id: "302", parentId: splitter3Id },
                { id: "303", parentId: splitter3Id },
                { id: "304", parentId: splitter3Id },
                { id: "305", parentId: splitter3Id },
                { id: "306", parentId: splitter3Id },
                { id: "307", parentId: splitter3Id },
                { id: "308", parentId: splitter3Id },
                { id: "309", parentId: splitter3Id },
            ],
            outputs: [
                { id: "200", parentId: splitter3Id },
                { id: "201", parentId: splitter3Id },
                { id: "202", parentId: splitter3Id },
                { id: "203", parentId: splitter3Id },
                { id: "204", parentId: splitter3Id },
                { id: "205", parentId: splitter3Id },
                { id: "206", parentId: splitter3Id },
                { id: "207", parentId: splitter3Id },
            ],
        },
    ]

    return (
        <div style={{ position: 'relative' }}>
            <span>
                <button onClick={() => { setVisualization('2D') }}>2D</button>
                <button onClick={() => { setVisualization('3D') }}>3D</button>
            </span>
            <div style={{ margin: '0 auto', width: '100vw', height: '100vh' }}>
                {visualization === "2D" ? <FiberCanvas initialCables={cables} objectsOnCanvas={[...splitters, ...commutators]} /> : <OpticalCableVisualizer cables={cables} />}
            </div>
        </div>
    )
}

export default App;