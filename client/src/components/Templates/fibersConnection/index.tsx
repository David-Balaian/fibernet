
import { ICable } from "src/utils/threeJSHelpers/types";
import FiberCanvas from "./canvasDraw";
import OpticalCanvas3D from "./three_fiber";
import OpticalCableVisualizer from "./threeJS";
import { v4 } from "uuid";
import { useState } from "react";
import { Splitter } from "src/utils/types";


const App = () => {

    const [visualization, setVisualization] = useState<"2D" | "3D">("3D")

    const cable1ID = v4();
    const cable2ID = v4();
    const cable3ID = v4();
    const cable4ID = v4();
    const cable5ID = v4();
    const largeTubeId = "54"
    const cables: ICable[] = [
        {
            id: cable1ID,
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)", id: "100", parentId: cable1ID },
                { color: "rgb(255, 165, 0)", id: "101", parentId: cable1ID },
                { color: "rgb(0, 128, 0)", id: "102", parentId: cable1ID },
                { color: "rgb(165, 42, 42)", id: "103", parentId: cable1ID },
                { color: "rgb(128, 128, 128)", id: "104", parentId: cable1ID },
                { color: "rgb(255, 255, 255)", id: "105", parentId: cable1ID },
                { color: "rgb(255, 0, 0)", id: "106", parentId: cable1ID },
                { color: "rgb(0, 0, 0)", id: "107", parentId: cable1ID },
                { color: "rgb(255, 255, 0)", id: "108", parentId: cable1ID },
                { color: "rgb(128, 0, 128)", id: "109", parentId: cable1ID },
                { color: "rgb(255, 192, 203)", id: "110", parentId: cable1ID },
                { color: "rgb(0, 255, 255)", id: "111", parentId: cable1ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "112", parentId: cable1ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "113", parentId: cable1ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "114", parentId: cable1ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "115", parentId: cable1ID },

            ]
        },
        {
            id: cable2ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "116", parentId: cable2ID },
                { color: "rgb(255, 165, 0)", id: "117", parentId: cable2ID },
                { color: "rgb(0, 128, 0)", id: "118", parentId: cable2ID },
                { color: "rgb(165, 42, 42)", id: "119", parentId: cable2ID },
                { color: "rgb(128, 128, 128)", id: "120", parentId: cable2ID },
                { color: "rgb(255, 255, 255)", id: "121", parentId: cable2ID },
                { color: "rgb(255, 0, 0)", id: "122", parentId: cable2ID },
                { color: "rgb(0, 0, 0)", id: "123", parentId: cable2ID },
                { color: "rgb(255, 255, 0)", id: "124", parentId: cable2ID },
                { color: "rgb(128, 0, 128)", id: "125", parentId: cable2ID },
                { color: "rgb(255, 192, 203)", id: "126", parentId: cable2ID },
                { color: "rgb(0, 255, 255)", id: "127", parentId: cable2ID },
                { color: "rgb(0, 0, 255)", isMarked: true, id: "128", parentId: cable2ID },
                { color: "rgb(255, 165, 0)", isMarked: true, id: "129", parentId: cable2ID },
                { color: "rgb(0, 128, 0)", isMarked: true, id: "130", parentId: cable2ID },
                { color: "rgb(165, 42, 42)", isMarked: true, id: "131", parentId: cable2ID },

            ]
        },
        {
            id: cable3ID,
            type: "in", fibers: [
                { color: "rgb(0, 0, 255)", id: "132", parentId: cable3ID },
                { color: "rgb(255, 165, 0)", id: "133", parentId: cable3ID },
                { color: "rgb(0, 128, 0)", id: "134", parentId: cable3ID },
                { color: "rgb(165, 42, 42)", id: "135", parentId: cable3ID },
                { color: "rgb(128, 128, 128)", id: "136", parentId: cable3ID },
                { color: "rgb(255, 255, 255)", id: "137", parentId: cable3ID },
                { color: "rgb(255, 0, 0)", id: "138", parentId: cable3ID },
                { color: "rgb(0, 0, 0)", id: "139", parentId: cable3ID },
            ]
        },
        {
            id: cable4ID,
            type: "out", fibers: [
                { color: "rgb(0, 0, 255)", id: "140", parentId: cable4ID },
                { color: "rgb(255, 0, 0)", id: "141", parentId: cable4ID },
            ]
        },
        {
            id: cable5ID,
            type: "out",
            tubes: [
                { color: "rgb(0, 0, 255)", id: "142", parentId: cable5ID },
                { color: "rgb(255, 165, 0)", id: "143", parentId: cable5ID },
                { color: "rgb(0, 128, 0)", id: "144", parentId: cable5ID },
                { color: "rgb(255, 0, 0)", id: "145", parentId: cable5ID },
            ],
            fibers: [
                { color: "rgb(0, 0, 255)", id: "146", parentId: cable5ID, tubeId: "142" },
                { color: "rgb(255, 165, 0)", id: "147", parentId: cable5ID, tubeId: "142" },
                { color: "rgb(0, 128, 0)", id: "148", parentId: cable5ID, tubeId: "142" },
                { color: "rgb(255, 0, 0)", id: "149", parentId: cable5ID, tubeId: "142" },
                { color: "rgb(0, 0, 255)", id: "150", parentId: cable5ID, tubeId: "143"  },
                { color: "rgb(255, 165, 0)", id: "151", parentId: cable5ID, tubeId: "143"  },
                { color: "rgb(0, 128, 0)", id: "152", parentId: cable5ID, tubeId: "143"  },
                { color: "rgb(165, 42, 42)", id: "153", parentId: cable5ID, tubeId: "144"  },
                { color: "rgb(128, 128, 128)", id: "154", parentId: cable5ID, tubeId: "144"  },
                { color: "rgb(255, 255, 255)", id: "155", parentId: cable5ID, tubeId: "145"  },
                { color: "rgb(255, 0, 0)", id: "156", parentId: cable5ID, tubeId: "145"  },
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
            inputs: [{ id: "157", parentId: splitter1Id }],
            outputs: [{ id: "158", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "61", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "60", parentId: splitter1Id, color: "rgb(255, 0, 0)" }, { id: "61", parentId: splitter1Id, color: "rgb(255, 0, 0)" }],
        },
        {
            name: "1/8",
            id: splitter2Id,
            inputs: [{ id: "159", parentId: splitter2Id }],
            outputs: [
                { color: "rgb(0, 0, 255)", id: "160", parentId: splitter2Id },
                { color: "rgb(255, 165, 0)", id: "161", parentId: splitter2Id },
                { color: "rgb(0, 128, 0)", id: "162", parentId: splitter2Id },
                { color: "rgb(165, 42, 42)", id: "163", parentId: splitter2Id },
                { color: "rgb(128, 128, 128)", id: "164", parentId: splitter2Id },
                { color: "rgb(255, 255, 255)", id: "165", parentId: splitter2Id },
                { color: "rgb(255, 0, 0)", id: "166", parentId: splitter2Id },
                { color: "rgb(0, 0, 0)", id: "167", parentId: splitter2Id },
            ],
        },
    ]

    const commutators = [
        {
            name: "OLT",
            id: splitter3Id,
            inputs: [
                { id: "168", parentId: splitter3Id },
                { id: "169", parentId: splitter3Id },
                { id: "170", parentId: splitter3Id },
                { id: "171", parentId: splitter3Id },
                { id: "172", parentId: splitter3Id },
                { id: "173", parentId: splitter3Id },
                { id: "174", parentId: splitter3Id },
                { id: "175", parentId: splitter3Id },
                { id: "176", parentId: splitter3Id },
                { id: "177", parentId: splitter3Id },
            ],
            outputs: [
                { id: "178", parentId: splitter3Id },
                { id: "179", parentId: splitter3Id },
                { id: "180", parentId: splitter3Id },
                { id: "181", parentId: splitter3Id },
                { id: "182", parentId: splitter3Id },
                { id: "183", parentId: splitter3Id },
                { id: "184", parentId: splitter3Id },
                { id: "185", parentId: splitter3Id },
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
                {visualization === "2D" ? <FiberCanvas initialCables={cables} objectsOnCanvas={[...splitters, ...commutators]} /> : <OpticalCableVisualizer objectsOnCanvas={[...splitters, ...commutators]}  cables={cables} />}
            </div>
        </div>
    )
}

export default App;