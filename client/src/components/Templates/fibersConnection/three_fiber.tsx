import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree, extend, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Tube } from '@react-three/drei';
import * as THREE from 'three';


// You can place this helper component within your OpticalCanvas3D.tsx file or in a separate file.
interface FitCameraToObjectsProps {
    objects: Cable3D[]; // Assuming Cable3D has position & dimensions
    fov: number;        // Camera FOV
    margin?: number;    // Margin factor for camera distance (e.g., 1.2 for 20% margin)
    enableControlsTargetUpdate?: boolean; // To update OrbitControls target
}

const FitCameraToObjects: React.FC<FitCameraToObjectsProps> = ({ 
    objects, 
    fov, 
    margin = 1.5, // Default margin
    enableControlsTargetUpdate = true 
}) => {
    const { camera, controls } = useThree(); // `controls` might be undefined if OrbitControls isn't default/used

    useEffect(() => {
        if (!objects || objects.length === 0 || !camera) {
            return;
        }

        const boundingBox = new THREE.Box3();

        objects.forEach(cable => {
            if (cable.position && cable.dimensions) {
                // Ensure position and dimensions are valid THREE.Vector3-like objects
                const cableCenter = new THREE.Vector3(cable.position.x, cable.position.y, cable.position.z);
                const cableSize = new THREE.Vector3(cable.dimensions.width, cable.dimensions.height, cable.dimensions.depth);
                
                if (isNaN(cableCenter.x) || isNaN(cableSize.x) || cableSize.x <=0 || cableSize.y <=0 || cableSize.z <=0) {
                    console.warn("Invalid cable position or dimensions for bounding box calculation", cable);
                    return;
                }

                const objectBox = new THREE.Box3().setFromCenterAndSize(cableCenter, cableSize);
                boundingBox.union(objectBox);
            }
        });

        if (boundingBox.isEmpty()) {
            console.log("Bounding box is empty, cannot fit camera.");
            return;
        }

        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        if (size.x === 0 && size.y === 0 && size.z === 0) {
            console.log("Bounding box has zero size, cannot fit camera effectively.");
            // Position camera at a default distance from the single point/center
            camera.position.set(center.x, center.y, center.z + 10 * margin); // Default distance
            camera.lookAt(center);
            if (enableControlsTargetUpdate && controls) {
                (controls as any).target.copy(center);
                (controls as any).update();
            }
            camera.updateProjectionMatrix();
            return;
        }
        
        const maxDim = Math.max(size.x, size.y); // Max dimension in XY plane primarily
        const fovRad = THREE.MathUtils.degToRad(fov);
        
        // Calculate distance to fit the object in view based on FOV and max dimension
        let distance = (maxDim / 2) / Math.tan(fovRad / 2);
        distance *= margin; // Apply margin

        // Position camera along Z axis, looking at the center of the bounding box.
        // Adjust camera's Z position to be `distance` away from the front face of the bounding box.
        camera.position.set(center.x, center.y, boundingBox.max.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        // If using OrbitControls, update its target
        if (enableControlsTargetUpdate && controls && (controls as any).target) {
            (controls as any).target.copy(center);
            (controls as any).update(); // Important for OrbitControls
        }

    }, [objects, camera, controls, fov, margin, enableControlsTargetUpdate]);

    return null; // This component does not render anything itself
};

// --- Re-use TypeScript Interfaces (with potential 3D additions later) ---
// IFiberFromProps, ICableFromProps, Fiber, Cable, Connection, Presplice
// We'll need to adapt 'rect', 'exitPoint' etc. for 3D in the internal types.

interface IFiberFromProps {
    color: string;
    isMarked?: boolean;
}

interface ICableFromProps {
    type: "in" | "out";
    fibers: IFiberFromProps[];
}

interface Fiber {
    id: string; // cableId-fiberIndex
    originalColor: string;
    isMarked?: boolean;
    // Calculated properties for rendering & interaction
    rect: { x: number; y: number; width: number; height: number }; // Bounding box
    exitPoint: { x: number; y: number }; // Point where connection line starts/ends
    cableId: string;
}

interface Cable {
    id: string; // originalIndex-type
    originalType: "in" | "out";
    fibers: Fiber[];
    // Position and orientation
    x: number;
    y: number;
    orientation: 'vertical' | 'horizontal'; // Vertical (on left/right), Horizontal (on top/bottom)
    // Visual dimensions
    rect: { x: number; y: number; width: number; height: number }; // Cable body
    dragHandle: { x: number; y: number; radius: number; isActive?: boolean };
    // State
    isDragging?: boolean;
}

interface Connection {
    id: string;
    fiber1Id: string;
    fiber2Id: string;
    path: { x: number; y: number }[]; // Points defining the Manhattan line
    color1: string;
    color2: string;
    isMarked1?: boolean;
    isMarked2?: boolean;
    controlPoints?: { x: number; y: number; radius: number }[];
    deleteIconRect?: { x: number; y: number; width: number; height: number };
}

interface Presplice {
    fiber1Id: string;
    fiber2Id: string;
    lineStart: { x: number; y: number };
    lineEnd: { x: number; y: number };
    plusIconPosition: { x: number; y: number; size: number };
}

interface OpticalCanvasProps {
    initialCables: ICableFromProps[];
    width?: number;
    height?: number;
}
interface Fiber3D extends Fiber {
    position: THREE.Vector3; // Center position in 3D space
    exitPoint3D: THREE.Vector3; // Point where connection line starts/ends in 3D
    dimensions: { width: number; height: number; depth: number };
}

interface Cable3D extends Cable {
    position: THREE.Vector3; // Center position in 3D space
    orientation3D: ' вдоль-Y' | 'вдоль-X' | 'вдоль-Z'; // Example orientations
    dimensions: { width: number; height: number; depth: number };
    fibers: Fiber3D[];
    // dragHandle equivalent in 3D might be the object itself or a specific gizmo
}

interface Connection3D extends Connection {
    path3D: THREE.Vector3[]; // Array of THREE.Vector3
}

interface OpticalCanvas3DProps {
    initialCables: ICableFromProps[];
    width?: number;  // Canvas width
    height?: number; // Canvas height
    depth?: number;  // Depth of the 3D scene space for cable separation
}

// --- Constants (adapt for 3D) ---
const CABLE_DIM_MAIN_AXIS = 50; // e.g., Length if oriented along Y
const CABLE_DIM_SIDE = 5;       // e.g., Width and Depth if oriented along Y
const FIBER_RADIUS = 0.5;
const FIBER_LENGTH_IN_CABLE = CABLE_DIM_SIDE; // How far fiber is visible inside cable body
const FIBER_EXIT_EXTENSION = 1; // How far fiber protrudes from cable face for connection
const FIBER_SPACING_3D = FIBER_RADIUS * 2.5;
const CONNECTION_TUBE_RADIUS = 0.2;

// --- Placeholder for complex 3D logic ---
const calculate3DLayout = (
    cablesToLayout: Cable3D[],
    sceneDepth: number,
    canvasHeight: number, // for initial Y distribution
    canvasWidth: number // for initial Y distribution
): Cable3D[] => {
    console.log("Calculating 3D Layout (Placeholder)", cablesToLayout, sceneDepth);
    // This is a highly complex function to be implemented.
    // It would set cable3D.position, cable3D.orientation3D, cable3D.dimensions
    // And for each fiber3D: fiber3D.position, fiber3D.exitPoint3D, fiber3D.dimensions

    let currentY_In = canvasHeight / 2 - CANVAS_PADDING_3D; // Start from top for 'in'
    let currentY_Out = canvasHeight / 2 - CANVAS_PADDING_3D; // Start from top for 'out'
    const cableVerticalSpacing3D = CABLE_DIM_MAIN_AXIS * 0.2; // Example spacing

    return cablesToLayout.map(cable => {
        const numFibers = cable.fibers.length;
        // Simplified: Assume cables are like tall boxes/cylinders along Y
        const cableHeight = numFibers * FIBER_SPACING_3D + FIBER_SPACING_3D; // Approximate
        const cableWidth = CABLE_DIM_SIDE;
        const cableDepth = CABLE_DIM_SIDE;

        let initialX = 0;
        let initialY = 0;
        let initialZ = 0;

        if (cable.originalType === 'in') {
            initialZ = -sceneDepth / 2;
            initialY = currentY_In - cableHeight / 2;
            currentY_In = initialY - cableHeight / 2 - cableVerticalSpacing3D;
        } else { // 'out'
            initialZ = sceneDepth / 2;
            initialY = currentY_Out - cableHeight / 2;
            currentY_Out = initialY - cableHeight / 2 - cableVerticalSpacing3D;
        }
        // X position might be fixed or based on some other logic
        initialX = (cable.originalType === 'in' ? - (canvasWidth || 1000) / 4 : (canvasWidth || 1000) / 4);


        const updatedCable = {
            ...cable,
            position: new THREE.Vector3(initialX, initialY + cableHeight/2 - (numFibers * FIBER_SPACING_3D)/2 , initialZ), // Centering logic needed
            dimensions: { width: cableWidth, height: cableHeight, depth: cableDepth },
            orientation3D: 'вдоль-Y', // Default
        } as Cable3D;

        updatedCable.fibers = cable.fibers.map((fiber, index) => {
            // Position fibers along the height of the cable, on its face
            const fiberY = initialY + cableHeight - FIBER_SPACING_3D * (index + 0.5) ;
            let fiberX = updatedCable.position.x;
            let fiberZ_exit = 0;
            let fiberZ_base = 0;

            if (cable.originalType === 'in') { // On -Z face, exiting towards +Z
                fiberZ_base = updatedCable.position.z - cableDepth / 2 + FIBER_LENGTH_IN_CABLE/2;
                fiberZ_exit = updatedCable.position.z + cableDepth / 2 + FIBER_EXIT_EXTENSION;
            } else { // On +Z face, exiting towards -Z
                fiberZ_base = updatedCable.position.z + cableDepth / 2 - FIBER_LENGTH_IN_CABLE/2;
                fiberZ_exit = updatedCable.position.z - cableDepth / 2 - FIBER_EXIT_EXTENSION;
            }

            return {
                ...fiber,
                position: new THREE.Vector3(fiberX, fiberY, fiberZ_base), // Center of fiber cylinder inside cable
                exitPoint3D: new THREE.Vector3(fiberX, fiberY, fiberZ_exit),
                dimensions: { radius: FIBER_RADIUS, height: FIBER_LENGTH_IN_CABLE } // for cylinder
            } as Fiber3D;
        });
        return updatedCable;
    });
};

const generate3DManhattanPath = (
    startFiber: Fiber3D, endFiber: Fiber3D,
    startCable: Cable3D, endCable: Cable3D,
    existingConnections: Connection3D[],
    sceneBounds: { width: number, height: number, depth: number }
): THREE.Vector3[] => {
    console.log("Generating 3D Path (Placeholder)");
    // Extremely complex: 3D A* or strategic pathfinding.
    // Needs 3D collision detection with other connections, fibers, cables.
    // For now, a direct line for visualization.
    if (!startFiber.exitPoint3D || !endFiber.exitPoint3D) return [];
    return [startFiber.exitPoint3D, endFiber.exitPoint3D];
};

const CANVAS_PADDING_3D = 5; // Padding from edges for initial placement

// --- React Components for 3D Objects ---
const Fiber3DMesh: React.FC<{ fiber: Fiber3D, onClick: () => void }> = ({ fiber, onClick }) => {
    if (!fiber.position) return null;
    return (
        <Cylinder args={[fiber.dimensions.radius, fiber.dimensions.radius, fiber.dimensions.height, 16]} position={fiber.position.toArray()} onClick={onClick}>
            <meshStandardMaterial color={fiber.originalColor} />
        </Cylinder>
    );
};

const Cable3DMesh: React.FC<{ cable: Cable3D, onFiberClick: (fiberId: string) => void }> = ({ cable, onFiberClick }) => {
    if (!cable.position || !cable.dimensions) return null;
    // Using Box for simplicity. Could be Cylinder.
    return (
        <group position={cable.position.toArray()}>
            <Box args={[cable.dimensions.width, cable.dimensions.height, cable.dimensions.depth]}>
                <meshStandardMaterial color="black" />
            </Box>
            {cable.fibers.map(fiber => (
                <Fiber3DMesh key={fiber.id} fiber={fiber} onClick={() => onFiberClick(fiber.id)} />
            ))}
            {/* Drag handle would be more complex in 3D, maybe an interactive gizmo or ability to drag the whole box */}
        </group>
    );
};

const Connection3DMesh: React.FC<{ connection: Connection3D }> = ({ connection }) => {
    if (!connection.path3D || connection.path3D.length < 2) return null;
    // Create a curve from the path points for the TubeGeometry
    const curve = useMemo(() => new THREE.CatmullRomCurve3(connection.path3D), [connection.path3D]);

    return (
        <Tube args={[curve, connection.path3D.length * 8, CONNECTION_TUBE_RADIUS, 8, false]}>
            {/* Simplification: single color. Two-tone would require multiple tubes or custom shader. */}
            <meshStandardMaterial color={connection.color1} />
        </Tube>
    );
};


const OpticalCanvas3D: React.FC<OpticalCanvas3DProps> = ({
    initialCables: initialCablesFromProps, // Renamed to avoid conflict
    width = 1000,
    height = 600,
    depth = 200, // Scene depth
}) => {
    const [managedCables, setManagedCables] = useState<Cable3D[]>([]);
    const [connections, setConnections] = useState<Connection3D[]>([]);
    const [selectedFiberId1, setSelectedFiberId1] = useState<string | null>(null);
    
    const sceneBounds = useMemo(() => ({ width, height, depth }), [width, height, depth]);
    const cameraFov = 50; // Define FOV to pass to helper

    useEffect(() => {
        const processedCables: Cable3D[] = initialCablesFromProps.map((c, index) => {
            // ... (your existing mapping logic to create initial Cable3D structures)
            // Ensure `position` and `dimensions` are at least initialized (even if to zero/placeholder)
            const cableId = `${index}-${c.type}`;
            return {
                id: cableId,
                originalType: c.type,
                fibers: c.fibers.map((f, fIndex) => ({
                    id: `${cableId}-${fIndex}`, originalColor: f.color, isMarked: f.isMarked, cableId: cableId,
                    position: new THREE.Vector3(), exitPoint3D: new THREE.Vector3(),
                    dimensions: { radius:0, height:0, depth:0}, // Initialize properly
                })),
                x:0, y:0, rect: {x:0,y:0,width:0,height:0}, // From 2D, will be replaced
                position: new THREE.Vector3(), // Placeholder, to be set by calculate3DLayout
                orientation: 'vertical', orientation3D: 'вдоль-Y',
                dimensions: { width: 0, height: 0, depth: 0 }, // Placeholder
                dragHandle: {x:0,y:0,radius:0}
            } as unknown as Cable3D;
        });
        // calculate3DLayout should populate cable.position and cable.dimensions correctly
        setManagedCables(calculate3DLayout(processedCables, depth, height, width));
    }, [initialCablesFromProps, depth, height]); // Make sure all deps for layout are here

    // ... (getFiberById3D, getCableByFiberId3D, handleFiberClick - keep as is)
     const getFiberById3D = useCallback((fiberId: string): Fiber3D | undefined => {
        for (const cable of managedCables) {
            const fiber = cable.fibers.find(f => f.id === fiberId);
            if (fiber) return fiber as Fiber3D; // Ensure cast if needed
        }
        return undefined;
    }, [managedCables]);
    
    const getCableByFiberId3D = useCallback((fiberId: string): Cable3D | undefined => {
        const cableIdParts = fiberId.split('-');
        if (cableIdParts.length < 2) return undefined;
        const cableId = `${cableIdParts[0]}-${cableIdParts[1]}`;
        return managedCables.find(c => c.id === cableId);
    }, [managedCables]);

    const handleFiberClick = useCallback((fiberId: string) => {
        // ... (your existing fiber click logic to create connections)
        // Ensure it uses Fiber3D and Connection3D types
        const fiber = getFiberById3D(fiberId);
        if (!fiber) return;

        if (!selectedFiberId1) {
            setSelectedFiberId1(fiberId);
        } else if (selectedFiberId1 !== fiberId) {
            const fiber1 = getFiberById3D(selectedFiberId1);
            const fiber2 = fiber;
            const cable1 = getCableByFiberId3D(selectedFiberId1);
            const cable2 = getCableByFiberId3D(fiberId);

            if (fiber1 && fiber2 && cable1 && cable2) {
                const newPath = generate3DManhattanPath(
                    fiber1, fiber2,
                    cable1, cable2,
                    connections, sceneBounds
                );
                if (newPath.length > 0) {
                    const newConnection: Connection3D = {
                        id: `conn3d-${Date.now()}`, fiber1Id: fiber1.id, fiber2Id: fiber2.id,
                        path: [], path3D: newPath, color1: fiber1.originalColor, color2: fiber2.originalColor,
                        isMarked1: fiber1.isMarked, isMarked2: fiber2.isMarked,
                    };
                    setConnections(prev => [...prev, newConnection]);
                }
            }
            setSelectedFiberId1(null);
        }
    }, [selectedFiberId1, getFiberById3D, getCableByFiberId3D, connections, sceneBounds]);



    console.log(managedCables, connections);
    

    // Placeholder for Interaction (Dragging, Editing)
    // This would involve complex raycasting, state management for drag states, etc.

    return (
        <Canvas 
            style={{ width: `${width}px`, height: `${height}px`, background: '#f0f0f0', border: '1px solid #ccc' }}
            // Camera props are now managed by FitCameraToObjects, but initial FOV can be set here
            // The initial position will be overridden once managedCables are ready.
            camera={{ fov: cameraFov, position: [0,0,depth] }} // Provide a sensible default initial position
        >
            <ambientLight intensity={0.7} />
            <pointLight position={[sceneBounds.width / 2, sceneBounds.height / 2, sceneBounds.depth]} intensity={1} />
            <pointLight position={[-sceneBounds.width / 2, -sceneBounds.height / 2, sceneBounds.depth]} intensity={0.5} />

            {managedCables.map(cable => (
                <Cable3DMesh key={cable.id} cable={cable} onFiberClick={handleFiberClick} />
            ))}

            {connections.map(conn => (
                <Connection3DMesh key={conn.id} connection={conn} />
            ))}

            <OrbitControls 
                makeDefault // Makes these controls accessible via useThree().controls
                // You might want to set min/max zoom distance or other props here
            /> 
            
            {/* Helper to adjust camera once cables are loaded and laid out */}
            {managedCables.length > 0 && (
                <FitCameraToObjects objects={managedCables} fov={cameraFov} margin={1.5} />
            )}
            
            {/* <axesHelper args={[Math.max(width, height, depth) / 10]} /> */}
        </Canvas>
    );
};

export default OpticalCanvas3D;