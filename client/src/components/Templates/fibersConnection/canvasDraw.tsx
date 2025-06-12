import React, { useRef, useEffect, useState, useCallback } from 'react';
import { save2DConnectionsToLocalStorage } from 'src/utils/helperFunctions'; // Assuming this exists
import { ICable as InitialICable, IFiber as InitialIFiber } from 'src/utils/threeJSHelpers/types'; // Assuming these exist
import { Splitter } from 'src/utils/types';
import { v4 } from 'uuid';

// Re-define local input types if they differ or for clarity
export type IFiber = {
    color: string;
    isMarked?: boolean;
    id: string;
    parentId: string;
    tubeId?: string;
};

export type ITube = {
    color: string;
    id: string;
    parentId: string;
};

export type ICable = {
    fibers: IFiber[];
    type: "in" | "out";
    id: string;
    tubes?: ITube[];
};



// --- TypeScript Interfaces for internal state and calculations ---
interface Fiber extends IFiber {
    originalColor: string;
    isMarked?: boolean;
    rect: { x: number; y: number; width: number; height: number };
    exitPoint: { x: number; y: number };
    // cableId is already part of IFiber
}

interface Tube extends ITube {
    rect: { x: number; y: number; width: number; height: number };
    fibers: Fiber[]; // Calculated fibers belonging to this tube
}

interface Cable extends ICable { // Note: ICable here is the input prop type
    id: string;
    originalType: "in" | "out";
    fibers: Fiber[]; // All calculated fibers in this cable
    tubes?: Tube[];   // All calculated tubes in this cable
    x: number;
    y: number;
    orientation: 'vertical' | 'horizontal';
    rect: { x: number; y: number; width: number; height: number };
    dragHandle: { x: number; y: number; radius: number; isActive?: boolean };
    isDragging?: boolean;
}

export interface Connection {
    id: string;
    fiber1Id: string;
    fiber2Id: string;
    path: { x: number; y: number }[];
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
    initialCables: ICable[]; // Using the locally defined ICable for props
    objectsOnCanvas?: Splitter[];
    width?: number;
    height?: number;
}

interface SplitterPort {
    id: string;
    parentId: string; // The ID of the splitter
    originalColor: string;
    color: string;
    isMarked?: boolean;
    rect: { x: number; y: number; width: number; height: number };
    exitPoint: { x: number; y: number };
    type: "in" | "out";
}

interface SplitterState extends Splitter {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number; // In radians
    inputs: SplitterPort[]; // Now contains calculated positions
    outputs: SplitterPort[]; // Now contains calculated positions
    dragHandle: { x: number; y: number; radius: number; isActive?: boolean };
    rotateHandle: { x: number; y: number; width: number; height: number; isActive?: boolean };
    isDragging?: boolean;
    isRotating?: boolean;
}




// --- Constants ---
const CABLE_THICKNESS = 50;
const FIBER_DIMENSION_PARALLEL = 20;    // Width for fibers in vertical cable, Height for fibers in horizontal cable
const FIBER_DIMENSION_PERPENDICULAR = 10; // 10 ///////// // Height for fibers in vertical cable, Width for fibers in horizontal cable
const FIBER_SPACING = 5; // 5 ///////// // Gap between fibers within a tube, or directly in cable if no tubes
const TUBE_PADDING = 10; // Padding inside the cable body around the tubes area
const TUBE_SPACING = 5; // Vertical gap between tubes inside a cable
const CANVAS_PADDING = 20; // Increased for better edge visibility


const DRAG_HANDLE_RADIUS = 4;
const DRAG_HANDLE_OFFSET = 10;
const PRESPLICE_PLUS_SIZE = 24;
const CONNECTION_CONTROL_POINT_RADIUS = 4;
const MIDPOINT_ADD_HANDLE_RADIUS = 3;
const MIDPOINT_ADD_HANDLE_COLOR = 'rgba(51, 155, 51, 0.8)';
const ROTATE_ICON_SIZE = 8;
const ROTATE_HANDLE_OFFSET = -10;

const DELETE_ICON_SIZE = 16;
const EDGE_TRANSFORM_THRESHOLD = 30;
const CONNECTION_LINE_WIDTH = 3; // 6 ////
const LINE_THICKNESS_FOR_COLLISION = 1;
const BEND_PENALTY = 30;
const PROXIMITY_PENALTY = 60;
const CROSSING_PENALTY = 250;
const PROXIMITY_MARGIN = LINE_THICKNESS_FOR_COLLISION + 4;
const cableVerticalSpacing = 20; // Initial vertical spacing between cables
const FIBER_AVOIDANCE_MARGIN = 8;
const FIBER_INTERSECTION_PENALTY = 500000;
const CABLE_AVOIDANCE_MARGIN = 4;
const CABLE_INTERSECTION_PENALTY = 400000;
const CENTRAL_CHANNEL_TOLERANCE = 20;
const CENTRAL_CHANNEL_REWARD = (2 * BEND_PENALTY) + 10;
const CONNECTION_VISUAL_OFFSET = 5; // Offset for connection lines to avoid fiber rectangles
const dx = 26; // Offset for delete icon
const dy = 8;  // Offset for delete icon

const SPLITTER_WIDTH = 40;
const SPLITTER_PADDING = FIBER_SPACING;
const SPLITTER_PORT_DIMENSION = FIBER_DIMENSION_PERPENDICULAR; // The size of the input/output squares
const SPLITTER_PORT_SPACING = FIBER_SPACING;


const GRID_GAP = 5;

const snapToGrid = (value: number): number => {
    return Math.round(value / GRID_GAP) * GRID_GAP;
};


const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, gap: number) => {
    ctx.save(); // Save the current context state (good practice)

    ctx.strokeStyle = 'rgb(156, 156, 156)'; // A light, non-intrusive grey for the grid
    ctx.lineWidth = 0.3;
    ctx.beginPath();

    // Draw vertical lines
    for (let x = 0; x < width; x += gap) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    // Draw horizontal lines
    for (let y = 0; y < height; y += gap) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke(); // Draw all the lines at once
    ctx.restore(); // Restore the context to its previous state
};

function getAABBOfRotatedRect(
    rect: { width: number, height: number },
    center: { x: number, y: number },
    rotation: number
): { x: number; y: number; width: number; height: number } {
    const { width, height } = rect;
    const { x: cx, y: cy } = center;

    // The 4 corners of the un-rotated rectangle relative to its center
    const corners = [
        { x: -width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 },
    ];

    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    corners.forEach(corner => {
        // Rotate the corner
        const rotatedX = corner.x * cosR - corner.y * sinR;
        const rotatedY = corner.x * sinR + corner.y * cosR;

        // Translate back to world coordinates
        const finalX = rotatedX + cx;
        const finalY = rotatedY + cy;

        // Update the min/max values
        minX = Math.min(minX, finalX);
        maxX = Math.max(maxX, finalX);
        minY = Math.min(minY, finalY);
        maxY = Math.max(maxY, finalY);
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const OpticalFiberCanvas: React.FC<OpticalCanvasProps> = ({
    initialCables: initialCablesFromProps, // Renamed to avoid conflict
    objectsOnCanvas = [],
    width = window.innerWidth,
    height = Math.max(window.innerHeight, Math.max(initialCablesFromProps.filter(item=>item.type === 'in').length, initialCablesFromProps.filter(item=>item.type === 'out').length) * 200),
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [managedCables, setManagedCables] = useState<Cable[]>([]);
    const [selectedFiberId1, setSelectedFiberId1] = useState<string | null>(null);
    const [activePresplice, setActivePresplice] = useState<Presplice | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [draggingCableInfo, setDraggingCableInfo] = useState<{ cableId: string; offsetX: number; offsetY: number } | null>(null);
    const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
    const [draggingControlPoint, setDraggingControlPoint] = useState<{ connectionId: string; pointIndex: number; offsetX: number; offsetY: number } | null>(null);
    const [managedSplitters, setManagedSplitters] = useState<SplitterState[]>([]);
    const [draggingSplitterInfo, setDraggingSplitterInfo] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const [rotatingSplitterInfo, setRotatingSplitterInfo] = useState<{ id: string; startAngle: number; initialRotation: number; } | null>(null);


    // Debounce resize
    const [dimensions, setDimensions] = useState({ width, height });
    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: Math.max(window.innerHeight, Math.max(initialCablesFromProps.filter(item=>item.type === 'in').length, initialCablesFromProps.filter(item=>item.type === 'out').length) * 200) });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    useEffect(() => {
        if (connections.length) {
            save2DConnectionsToLocalStorage(connections);
        }
    }, [connections]);


    const getConnectionPointById = useCallback((pointId: string): (Fiber | SplitterPort) | undefined => {
        // Search in cables
        for (const cable of managedCables) {
            const fiber = cable.fibers.find(f => f.id === pointId);
            if (fiber) return fiber;
        }
        // Search in splitters
        for (const splitter of managedSplitters) {
            const inputPort = splitter.inputs.find(i => i.id === pointId);
            if (inputPort) return inputPort;
            const outputPort = splitter.outputs.find(o => o.id === pointId);
            if (outputPort) return outputPort;
        }
        return undefined;
    }, [managedCables, managedSplitters]);

    const calculateSplitterLayout = useCallback((splitters: SplitterState[]): SplitterState[] => {
        return splitters.map(splitter => {
            // First, calculate height and basic properties
            const numPorts = Math.max(splitter.inputs.length, splitter.outputs.length);
            const contentHeight = ((numPorts * SPLITTER_PORT_DIMENSION) + Math.max(0, numPorts - 1) * SPLITTER_PORT_SPACING);
            const splitterHeight = (contentHeight + (2 * SPLITTER_PADDING));

            const { x: centerX, y: centerY, rotation } = splitter;

            // Helper to apply rotation to a point around the splitter's center
            const getRotatedPoint = (point: { x: number; y: number }) => {
                const translatedX = point.x - centerX;
                const translatedY = point.y - centerY;
                const cosR = Math.cos(rotation);
                const sinR = Math.sin(rotation);
                const rotatedX = translatedX * cosR - translatedY * sinR;
                const rotatedY = translatedX * sinR + translatedY * cosR;
                return { x: rotatedX + centerX, y: rotatedY + centerY };
            };

            const newInputs: SplitterPort[] = splitter.inputs.map((input, i) => {
                // Calculate position as if rotation is 0
                const baseY = centerY - splitterHeight / 2 + SPLITTER_PADDING + (i * (SPLITTER_PORT_DIMENSION + SPLITTER_PORT_SPACING));
                const baseX = centerX - SPLITTER_WIDTH / 2;

                const portRect = {
                    x: (baseX - SPLITTER_PORT_DIMENSION), // The corner of the port's rect
                    y: (baseY)
                };
                const exitPoint = {
                    x: (portRect.x), // Exit from the outer edge
                    y: (portRect.y + SPLITTER_PORT_DIMENSION / 2)
                };

                return {
                    ...input,
                    type: 'in',
                    parentId: splitter.id,
                    originalColor: input.color || 'grey',
                    // Store the final, rotated positions in the state
                    rect: { ...getRotatedPoint(portRect), width: SPLITTER_PORT_DIMENSION, height: SPLITTER_PORT_DIMENSION },
                    exitPoint: getRotatedPoint(exitPoint),
                };
            });

            // Repeat for outputs
            const newOutputs: SplitterPort[] = splitter.outputs.map((output, i) => {
                const baseY = centerY - splitterHeight / 2 + SPLITTER_PADDING + (i * (SPLITTER_PORT_DIMENSION + SPLITTER_PORT_SPACING));
                const baseX = centerX + SPLITTER_WIDTH / 2;

                const portRect = { x: baseX, y: baseY };
                const exitPoint = {
                    x: portRect.x + SPLITTER_PORT_DIMENSION,
                    y: portRect.y + SPLITTER_PORT_DIMENSION / 2,
                };

                return {
                    ...output,
                    type: 'out',
                    parentId: splitter.id,
                    originalColor: output.color || 'grey',
                    rect: { ...getRotatedPoint(portRect), width: FIBER_DIMENSION_PARALLEL, height: FIBER_DIMENSION_PERPENDICULAR },
                    exitPoint: getRotatedPoint(exitPoint),
                };
            });

            return {
                ...splitter,
                width: SPLITTER_WIDTH,
                height: splitterHeight,
                inputs: newInputs,
                outputs: newOutputs,
                // Handles should not rotate with the body
                dragHandle: { x: snapToGrid(centerX - SPLITTER_WIDTH / 2), y: snapToGrid(centerY - snapToGrid(splitterHeight / 2)), radius: DRAG_HANDLE_RADIUS },
                rotateHandle: { x: centerX + SPLITTER_WIDTH / 2 + ROTATE_HANDLE_OFFSET, y: centerY - splitterHeight / 2, width: ROTATE_ICON_SIZE, height: ROTATE_ICON_SIZE }
            };
        });
    }, []);


    const getCableById = useCallback((cableId?: string): Cable | undefined => {
        return managedCables.find(c => c.id === cableId);
    }, [managedCables]);

    // --- Initialization and Layout Calculation ---
    const calculateLayout = useCallback((cablesToLayout: Cable[]): Cable[] => {
        // cablesToLayout are partially initialized Cable objects (with x, y, orientation, raw fibers/tubes)
        return cablesToLayout.map(currentCable => {
            let cableX = currentCable.x;
            let cableY = currentCable.y;
            let cableViewWidth = 0;  // Visual width on canvas
            let cableViewHeight = 0; // Visual height on canvas

            const allUpdatedFibersForThisCable: Fiber[] = [];
            const calculatedTubesForThisCable: Tube[] = [];

            if (currentCable.orientation === 'vertical') {
                cableViewWidth = CABLE_THICKNESS;
                // cableViewHeight will be determined by content below

                const rawInputTubes = currentCable.tubes || []; // These are ITube[] from initial props or existing state
                const hasTubes = rawInputTubes.length > 0;

                if (hasTubes) {
                    let currentContentOffsetY_InCable = TUBE_PADDING; // Relative Y for tube/fiber content from cable.y

                    rawInputTubes.forEach(rawTubeInfo => {
                        const fibersForThisTube_raw = currentCable.fibers.filter(f => f.tubeId === rawTubeInfo.id);

                        const tubeFibers_processed: Fiber[] = [];
                        let fiberContentHeightInTube = 0;

                        if (fibersForThisTube_raw.length > 0) {
                            fibersForThisTube_raw.forEach((fiberInfo, index) => {
                                const fWidth = FIBER_DIMENSION_PARALLEL;
                                const fHeight = FIBER_DIMENSION_PERPENDICULAR;

                                const fiberAbsY = cableY + currentContentOffsetY_InCable + (index * (fHeight + FIBER_SPACING));

                                let fiberAbsX_rect, fiberExitX;
                                if (currentCable.originalType === 'in') {
                                    fiberAbsX_rect = cableX + cableViewWidth; // Fiber rectangle outside cable body
                                    fiberExitX = fiberAbsX_rect + fWidth;
                                } else { // 'out'
                                    fiberAbsX_rect = cableX - fWidth; // Fiber rectangle outside cable body
                                    fiberExitX = fiberAbsX_rect;
                                }
                                const fiberExitY = fiberAbsY + fHeight / 2;

                                tubeFibers_processed.push({
                                    ...fiberInfo,
                                    originalColor: fiberInfo.color, // Ensure originalColor is set
                                    rect: { x: fiberAbsX_rect, y: fiberAbsY, width: fWidth, height: fHeight },
                                    exitPoint: { x: fiberExitX, y: fiberExitY },
                                });
                            });
                            fiberContentHeightInTube = (fibersForThisTube_raw.length * FIBER_DIMENSION_PERPENDICULAR) +
                                ((fibersForThisTube_raw.length - 1) * FIBER_SPACING);
                        } else {
                            fiberContentHeightInTube = FIBER_DIMENSION_PERPENDICULAR; // Min height for an empty tube
                        }


                        const tubeRectX_abs = cableX;
                        const tubeRectY_abs = cableY + currentContentOffsetY_InCable;
                        const tubeRectWidth = cableViewWidth - (2 * TUBE_PADDING);
                        const tubeRectHeight = fiberContentHeightInTube;

                        calculatedTubesForThisCable.push({
                            ...rawTubeInfo,
                            rect: { x: tubeRectX_abs, y: tubeRectY_abs, width: tubeRectWidth, height: tubeRectHeight },
                            fibers: tubeFibers_processed,
                        });
                        allUpdatedFibersForThisCable.push(...tubeFibers_processed);
                        currentContentOffsetY_InCable += tubeRectHeight + TUBE_SPACING;
                    });
                    cableViewHeight = currentContentOffsetY_InCable - TUBE_SPACING + TUBE_PADDING;
                } else { // No tubes, layout fibers directly
                    allUpdatedFibersForThisCable.push(...currentCable.fibers.map((fiberInfo, index) => {
                        const fWidth = FIBER_DIMENSION_PARALLEL;
                        const fHeight = FIBER_DIMENSION_PERPENDICULAR;
                        const fiberAbsY = cableY + FIBER_SPACING + (index * (fHeight + FIBER_SPACING));
                        let fiberAbsX_rect, fiberExitX;
                        if (currentCable.originalType === 'in') {
                            fiberAbsX_rect = cableX + cableViewWidth;
                            fiberExitX = fiberAbsX_rect + fWidth;
                        } else {
                            fiberAbsX_rect = cableX - fWidth;
                            fiberExitX = fiberAbsX_rect;
                        }
                        const fiberExitY = fiberAbsY + fHeight / 2;
                        return {
                            ...fiberInfo,
                            originalColor: fiberInfo.color,
                            rect: { x: fiberAbsX_rect, y: fiberAbsY, width: fWidth, height: fHeight },
                            exitPoint: { x: fiberExitX, y: fiberExitY },
                        };
                    }));
                    cableViewHeight = snapToGrid((currentCable.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING)) -
                        FIBER_SPACING + (2 * FIBER_SPACING)); // Outer spacing for fibers
                }
            } else { // Horizontal Cable
                cableViewHeight = CABLE_THICKNESS;
                // Simplified: Fibers directly in cable for horizontal (can be expanded later)
                let currentContentOffsetX_InCable = FIBER_SPACING;
                allUpdatedFibersForThisCable.push(...currentCable.fibers.map((fiberInfo, index) => {
                    const fWidth = FIBER_DIMENSION_PERPENDICULAR; // For horizontal, parallel is perpendicular to cable body
                    const fHeight = FIBER_DIMENSION_PARALLEL;
                    const fiberAbsX = cableX + currentContentOffsetX_InCable + (index * (fWidth + FIBER_SPACING));

                    let fiberAbsY_rect, fiberExitY;
                    if (currentCable.y < dimensions.height / 2) { // Top edge
                        fiberAbsY_rect = cableY + cableViewHeight;
                        fiberExitY = fiberAbsY_rect + fHeight;
                    } else { // Bottom edge
                        fiberAbsY_rect = cableY - fHeight;
                        fiberExitY = fiberAbsY_rect;
                    }
                    const fiberExitX = fiberAbsX + fWidth / 2;
                    return {
                        ...fiberInfo,
                        originalColor: fiberInfo.color,
                        rect: { x: fiberAbsX, y: fiberAbsY_rect, width: fWidth, height: fHeight },
                        exitPoint: { x: fiberExitX, y: fiberExitY }
                    };
                }));
                cableViewWidth = (currentCable.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING)) -
                    FIBER_SPACING + (2 * FIBER_SPACING);
            }

            // Clamp cable to canvas boundaries (after its height/width is known)
            cableX = Math.max(0, Math.min(dimensions.width - cableViewWidth, cableX));
            cableY = Math.max(0, Math.min(dimensions.height - cableViewHeight, cableY));

            let dhx, dhy;
            if (currentCable.orientation === 'vertical') {
                dhx = (currentCable.originalType === 'in') ? cableX + cableViewWidth - DRAG_HANDLE_OFFSET : cableX + DRAG_HANDLE_OFFSET;
                dhy = cableY + DRAG_HANDLE_OFFSET;
            } else {
                dhx = cableX + cableViewWidth - DRAG_HANDLE_OFFSET;
                dhy = (currentCable.y < dimensions.height / 2) ? cableY + DRAG_HANDLE_OFFSET : cableY + cableViewHeight - DRAG_HANDLE_OFFSET;
            }

            return {
                ...currentCable,
                fibers: allUpdatedFibersForThisCable,
                tubes: calculatedTubesForThisCable,
                rect: { x: cableX, y: cableY, width: cableViewWidth, height: cableViewHeight },
                dragHandle: { x: dhx, y: dhy, radius: DRAG_HANDLE_RADIUS },
            };
        });
    }, [dimensions.width, dimensions.height]);

    useEffect(() => {
        const processedCablesForLayout: Cable[] = [];
        let currentInCableBottomY = CANVAS_PADDING - cableVerticalSpacing;
        let currentOutCableBottomY = CANVAS_PADDING - cableVerticalSpacing;

        const processedSplitters: SplitterState[] = objectsOnCanvas.map((s_input, index) => ({
            ...s_input,
            x: dimensions.width / 2, // Default position
            y: (dimensions.height / 3) + (index * 150), // Stagger them vertically
            width: SPLITTER_WIDTH,
            height: 0, // Initial estimate, will be recalculated
            rotation: 0,
            // Temporarily initialize with empty arrays; layout function will populate them
            inputs: s_input.inputs.map(i => ({ ...i })) as any,
            outputs: s_input.outputs.map(o => ({ ...o })) as any,
            dragHandle: { x: 0, y: 0, radius: DRAG_HANDLE_RADIUS },
            rotateHandle: { x: 0, y: 0, width: ROTATE_ICON_SIZE, height: ROTATE_ICON_SIZE }
        }));
        setManagedSplitters(calculateSplitterLayout(processedSplitters));



        initialCablesFromProps.forEach((c_input) => {
            const orientation: 'vertical' | 'horizontal' = 'vertical'; // Default to vertical for now

            // --- More Accurate Initial Height Estimation ---
            let estimatedCableVisualHeight = 0;
            if (orientation === 'vertical') {
                const hasTubes = c_input.tubes && Array.isArray(c_input.tubes) && c_input.tubes.length > 0;
                if (hasTubes) {
                    let totalContentHeight = TUBE_PADDING; // Top cable padding
                    c_input.tubes!.forEach((tubeInfo, tubeIndex) => {
                        const fibersInTube = c_input.fibers.filter(f => f.tubeId === tubeInfo.id);
                        if (fibersInTube.length > 0) {
                            const fiberBlockHeight = (fibersInTube.length * FIBER_DIMENSION_PERPENDICULAR) +
                                ((fibersInTube.length - 1) * FIBER_SPACING);
                            totalContentHeight += fiberBlockHeight;
                        } else {
                            totalContentHeight += FIBER_DIMENSION_PERPENDICULAR; // Min height for an empty tube
                        }
                        if (tubeIndex < c_input.tubes!.length - 1) {
                            totalContentHeight += TUBE_SPACING;
                        }
                    });
                    totalContentHeight += TUBE_PADDING; // Bottom cable padding
                    estimatedCableVisualHeight = totalContentHeight;
                } else { // No tubes
                    estimatedCableVisualHeight = c_input.fibers.length > 0 ?
                        (c_input.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING)) - FIBER_SPACING + (2 * FIBER_SPACING)
                        : CABLE_THICKNESS; // Min height if empty
                }
            } else { // Horizontal (Simplified estimation)
                estimatedCableVisualHeight = CABLE_THICKNESS;
            }
            // --- End Accurate Estimation ---

            let initialX = 0;
            let initialY = 0;

            if (c_input.type === 'in') {
                initialX = CANVAS_PADDING;
                initialY = currentInCableBottomY + cableVerticalSpacing;
                currentInCableBottomY = initialY + estimatedCableVisualHeight;
            } else { // c_input.type === 'out'
                initialX = dimensions.width - CABLE_THICKNESS - CANVAS_PADDING; // Initial assumption
                initialY = currentOutCableBottomY + cableVerticalSpacing;
                currentOutCableBottomY = initialY + estimatedCableVisualHeight;
            }

            // Prepare a partial Cable object for calculateLayout
            processedCablesForLayout.push({
                // These are from ICable (props)
                id: c_input.id,
                type: c_input.type, // Will be used by calculateLayout to determine fiber exit
                // These are specific to the internal Cable interface
                originalType: c_input.type,
                fibers: c_input.fibers.map(f => ({ ...f, originalColor: f.color, rect: { x: 0, y: 0, width: 0, height: 0 }, exitPoint: { x: 0, y: 0 } })), // Pass raw fibers; layout calculates rects
                tubes: c_input.tubes ? c_input.tubes.map(t => ({ ...t, rect: { x: 0, y: 0, width: 0, height: 0 }, fibers: [] })) : [], // Pass raw tubes
                x: initialX,
                y: initialY,
                orientation: orientation,
                rect: { x: initialX, y: initialY, width: (orientation === 'vertical' ? CABLE_THICKNESS : estimatedCableVisualHeight), height: (orientation === 'vertical' ? estimatedCableVisualHeight : CABLE_THICKNESS) },
                dragHandle: { x: 0, y: 0, radius: DRAG_HANDLE_RADIUS },
            });
        });

        setManagedCables(calculateLayout(processedCablesForLayout));
    }, [initialCablesFromProps, dimensions.width, dimensions.height, calculateLayout]);


    useEffect(() => {
        // Load connections from localStorage and regenerate paths
        const initialConnections = localStorage.getItem("connections2D");
        if (initialConnections && managedCables.length > 0) { // Ensure cables are laid out first
            const parsedInitialConnections: Connection[] = JSON.parse(initialConnections);
            const tempConnections: Connection[] = []; // To provide to path generation for current batch
            const connectionsWithPathRegeneration = parsedInitialConnections.map(conn => {
                if (conn.path.length === 0) { // Regenerate if path is missing
                    const fiber1 = getConnectionPointById(conn.fiber1Id);
                    const fiber2 = getConnectionPointById(conn.fiber2Id);
                    if (fiber1 && fiber2) {
                        const cable1 = getCableById(fiber1.parentId);
                        const cable2 = getCableById(fiber2.parentId);
                        if (cable1 && cable2) {
                            const newPath = generateManhattanPathWithAvoidance(fiber1, fiber2, cable1, cable2, tempConnections, dimensions.width, dimensions.height);
                            const newConn = {
                                ...conn,
                                path: newPath,
                                color1: fiber1.originalColor,
                                color2: fiber2.originalColor,
                                isMarked1: fiber1.isMarked,
                                isMarked2: fiber2.isMarked,
                            };
                            tempConnections.push(newConn); // Add to current batch for collision checks
                            return newConn;
                        }
                    }
                }
                // if path exists, still add it to tempConnections if it's valid
                // This part might need adjustment if existing paths also need to be collision-checked
                // For now, only pushing newly generated paths to tempConnections for the current map op.
                return conn;
            }).filter(Boolean) as Connection[]; // Filter out any nulls if fibers/cables weren't found

            setConnections(connectionsWithPathRegeneration);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managedCables]); // Rerun when cables change,  getConnectionPointById/getCableById will have new cable data.


    // --- Drawing Functions ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        drawGrid(ctx, dimensions.width, dimensions.height, GRID_GAP);

        managedCables.forEach(cable => {
            ctx.fillStyle = 'black'; // Cable Body
            ctx.fillRect(cable.rect.x, cable.rect.y, cable.rect.width, cable.rect.height);

            // Draw Tubes
            if (cable.tubes) {
                cable.tubes.forEach(tube => {
                    ctx.fillStyle = tube.color;
                    ctx.fillRect(tube.rect.x, tube.rect.y, tube.rect.width, tube.rect.height);
                });
            }

            // Draw Fibers (they will appear on top of tubes if tube rects are correct)
            // The fiber rects are absolute, calculated to be outside the cable body
            cable.fibers.forEach(fiber => {
                ctx.fillStyle = fiber.originalColor;
                ctx.fillRect(fiber.rect.x, fiber.rect.y, fiber.rect.width, fiber.rect.height);

                if (selectedFiberId1 === fiber.id && !activePresplice) {
                    ctx.strokeStyle = 'yellow';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(fiber.rect.x, fiber.rect.y, fiber.rect.width, fiber.rect.height);
                }

                if (fiber.isMarked) {
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 1;
                    const numMarks = 3;
                    for (let i = 1; i <= numMarks; i++) {
                        if (cable.orientation === 'vertical') {
                            const markY = fiber.rect.y + (fiber.rect.height * i / (numMarks + 1));
                            ctx.beginPath();
                            ctx.moveTo(fiber.rect.x, markY);
                            ctx.lineTo(fiber.rect.x + fiber.rect.width, markY);
                            ctx.stroke();
                        } else {
                            const markX = fiber.rect.x + (fiber.rect.width * i / (numMarks + 1));
                            ctx.beginPath();
                            ctx.moveTo(markX, fiber.rect.y);
                            ctx.lineTo(markX, fiber.rect.y + fiber.rect.height);
                            ctx.stroke();
                        }
                    }
                }
            });
            ctx.beginPath();
            ctx.arc(cable.dragHandle.x, cable.dragHandle.y, cable.dragHandle.radius, 0, 2 * Math.PI);
            ctx.fillStyle = cable.dragHandle.isActive ? 'lime' : 'green';
            ctx.fill();
        });

        managedSplitters.forEach(splitter => {
            const { x, y, width, height, rotation, name, inputs, outputs, dragHandle, rotateHandle } = splitter;

            // --- Draw the ROTATED body and name ---
            ctx.save();
            ctx.translate(x, y); // Move origin to splitter center
            ctx.rotate(rotation);

            // Draw Body
            ctx.fillStyle = '#333';
            ctx.fillRect(-width / 2, -height / 2, width, height);
            ctx.strokeStyle = 'gold';
            ctx.strokeRect(-width / 2, -height / 2, width, height);

            // Draw Name
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, 0, 0); // Draw at the new (0,0) origin

            ctx.restore(); // Restore canvas to normal coordinate system

            // --- Draw the NON-ROTATED handles at their absolute positions ---
            ctx.beginPath();
            ctx.arc(dragHandle.x, dragHandle.y, dragHandle.radius, 0, 2 * Math.PI);
            ctx.fillStyle = splitter.dragHandle.isActive ? 'lime' : 'green';
            ctx.fill();

            ctx.fillStyle = splitter.rotateHandle.isActive ? 'cyan' : 'blue';
            ctx.fillRect(rotateHandle.x, rotateHandle.y, rotateHandle.width, rotateHandle.height);
            ctx.strokeStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.strokeText('⟳', rotateHandle.x + rotateHandle.width / 2, rotateHandle.y + rotateHandle.height / 2);

            // --- Draw the ports at their final, pre-calculated rotated positions ---
            const drawPort = (port: SplitterPort) => {
                // The port.rect.{x,y} are already the final rotated coordinates from calculateSplitterLayout
                ctx.fillStyle = port.originalColor;
                ctx.fillRect(port.rect.x, port.rect.y, port.rect.width, port.rect.height);

                if (selectedFiberId1 === port.id) {
                    ctx.strokeStyle = 'yellow';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(port.rect.x, port.rect.y, port.rect.width, port.rect.height);
                }
            };

            inputs.forEach(drawPort);
            outputs.forEach(drawPort);
        });

        connections.forEach(conn => {
            const fiber1 = getConnectionPointById(conn.fiber1Id);
            const fiber2 = getConnectionPointById(conn.fiber2Id);
            if (!fiber1 || !fiber2 || conn.path.length === 0) return;

            ctx.lineWidth = CONNECTION_LINE_WIDTH;
            if (conn.path.length > 0) {
                ctx.beginPath();
                ctx.moveTo(fiber1.exitPoint.x, fiber1.exitPoint.y);
                ctx.lineTo(conn.path[0].x, conn.path[0].y);
                ctx.strokeStyle = conn.color1;
                ctx.stroke();
            }
            if (conn.path.length > 0) {
                const lastPathPoint = conn.path[conn.path.length - 1];
                ctx.beginPath();
                ctx.moveTo(lastPathPoint.x, lastPathPoint.y);
                ctx.lineTo(fiber2.exitPoint.x, fiber2.exitPoint.y);
                ctx.strokeStyle = conn.color2;
                ctx.stroke();
            }

            const midPointIndex = Math.floor(conn.path.length / 2);
            if (conn.path.length > 0) {
                ctx.strokeStyle = conn.color1;
                ctx.beginPath();
                ctx.moveTo(conn.path[0].x, conn.path[0].y);
                const firstHalfEndIndex = conn.path.length === 1 ? 0 : midPointIndex;
                for (let i = 1; i <= firstHalfEndIndex; i++) {
                    if (conn.path[i]) { ctx.lineTo(conn.path[i].x, conn.path[i].y); }
                }
                if (firstHalfEndIndex > 0 || conn.path.length === 1) { ctx.stroke(); }
                if (conn.isMarked1) { drawMarksOnPath(ctx, conn.path.slice(0, firstHalfEndIndex + 1), conn.color1); }
                ctx.lineWidth = CONNECTION_LINE_WIDTH;
            }
            if (midPointIndex < conn.path.length - 1 || (conn.path.length === 1 && midPointIndex === 0)) {
                ctx.strokeStyle = conn.color2;
                ctx.beginPath();
                const secondHalfStartIndex = conn.path.length === 1 ? 0 : midPointIndex;

                if (conn.path[secondHalfStartIndex]) {
                    ctx.moveTo(conn.path[secondHalfStartIndex].x, conn.path[secondHalfStartIndex].y);
                    for (let i = secondHalfStartIndex + 1; i < conn.path.length; i++) {
                        if (conn.path[i]) { ctx.lineTo(conn.path[i].x, conn.path[i].y); }
                    }
                    if (conn.path.length > secondHalfStartIndex + 1 || (conn.path.length === 1 && secondHalfStartIndex === 0)) { ctx.stroke(); }
                    if (conn.isMarked2) {
                        drawMarksOnPath(ctx, conn.path.slice(secondHalfStartIndex), conn.color2);
                    }
                }
            }

            if (editingConnectionId === conn.id) {
                conn.controlPoints?.forEach(cp => {
                    ctx.beginPath();
                    ctx.arc(cp.x, cp.y, CONNECTION_CONTROL_POINT_RADIUS, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(0,0,255,0.7)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,150,0.9)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });

                if (conn.path.length >= 2) {
                    for (let i = 0; i < conn.path.length - 1; i++) {
                        const p1 = conn.path[i];
                        const p2 = conn.path[i + 1];
                        if (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) > MIDPOINT_ADD_HANDLE_RADIUS * 4) {
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;
                            ctx.beginPath();
                            ctx.arc(midX, midY, MIDPOINT_ADD_HANDLE_RADIUS, 0, 2 * Math.PI);
                            ctx.fillStyle = MIDPOINT_ADD_HANDLE_COLOR;
                            ctx.fill();
                            ctx.strokeStyle = 'rgba(0,100,0,0.9)';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
                if (conn.deleteIconRect) {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(conn.path[0].x - dx, conn.path[0].y - dy, conn.deleteIconRect.width, conn.deleteIconRect.height);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(conn.path[0].x + 4 - dx, conn.path[0].y + 4 - dy);
                    ctx.lineTo(conn.path[0].x + conn.deleteIconRect.width - 4 - dx, conn.path[0].y + conn.deleteIconRect.height - 4 - dy);
                    ctx.moveTo(conn.path[0].x + conn.deleteIconRect.width - 4 - dx, conn.path[0].y + 4 - dy);
                    ctx.lineTo(conn.path[0].x + 4 - dx, conn.path[0].y + conn.deleteIconRect.height - 4 - dy);
                    ctx.stroke();

                    ctx.fillStyle = 'red';
                    ctx.fillRect(conn.path[conn.path.length - 1].x + dx - 16, conn.path[conn.path.length - 1].y - dy, conn.deleteIconRect.width, conn.deleteIconRect.height);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(conn.path[conn.path.length - 1].x + 4 + dx - 16, conn.path[conn.path.length - 1].y + 4 - dy);
                    ctx.lineTo(conn.path[conn.path.length - 1].x + conn.deleteIconRect.width - 4 + dx - 16, conn.path[conn.path.length - 1].y + conn.deleteIconRect.height - 4 - dy);
                    ctx.moveTo(conn.path[conn.path.length - 1].x + conn.deleteIconRect.width - 4 + dx - 16, conn.path[conn.path.length - 1].y + 4 - dy);
                    ctx.lineTo(conn.path[conn.path.length - 1].x + 4 + dx - 16, conn.path[conn.path.length - 1].y + conn.deleteIconRect.height - 4 - dy);
                    ctx.stroke();
                }
            }
        });



        if (activePresplice) {
            ctx.beginPath();
            ctx.moveTo(activePresplice.lineStart.x, activePresplice.lineStart.y);
            ctx.lineTo(activePresplice.lineEnd.x, activePresplice.lineEnd.y);
            ctx.strokeStyle = 'grey';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            const { x, y, size } = activePresplice.plusIconPosition;
            ctx.fillStyle = 'green';
            ctx.fillRect(x - size / 2, y - size / 6, size, size / 3);
            ctx.fillRect(x - size / 6, y - size / 2, size / 3, size);
        }






    }, [managedCables, connections, managedSplitters, activePresplice, selectedFiberId1, editingConnectionId, dimensions.width, dimensions.height, getConnectionPointById /* drawMarksOnPath removed as dep, assumed stable */]);

    const drawMarksOnPath = (ctx: CanvasRenderingContext2D, path: { x: number, y: number }[], color: string) => {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        const markLength = CONNECTION_LINE_WIDTH;
        const markSpacing = 10;

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const dx_seg = p2.x - p1.x;
            const dy_seg = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx_seg * dx_seg + dy_seg * dy_seg);
            if (segmentLength < markSpacing) continue; // Avoid drawing on very short segments
            const numMarks = Math.floor(segmentLength / markSpacing);

            for (let j = 1; j <= numMarks; j++) {
                const t = (j * markSpacing) / segmentLength;
                const x = p1.x + t * dx_seg;
                const y = p1.y + t * dy_seg;

                ctx.beginPath();
                // For Manhattan paths, marks are perpendicular to the segment
                if (Math.abs(dx_seg) > Math.abs(dy_seg)) { // Horizontal segment
                    ctx.moveTo(x, y - markLength / 2);
                    ctx.lineTo(x, y + markLength / 2);
                } else { // Vertical segment
                    ctx.moveTo(x - markLength / 2, y);
                    ctx.lineTo(x + markLength / 2, y);
                }
                ctx.stroke();
            }
        }
    };


    useEffect(() => {
        draw();
    }, [draw]);

    // --- Manhattan Path Generation and Collision Detection ( Largely Unchanged ) ---
    // ... (isSegmentTooClose, pathIsTooClose, doSegmentsOverlap, pathCollides functions remain the same) ...
    // Make sure they are defined within the component or correctly passed dependencies.

    function isSegmentTooClose(
        s1p1: { x: number; y: number }, s1p2: { x: number; y: number },
        s2p1: { x: number; y: number }, s2p2: { x: number; y: number },
        proximityMargin: number
    ): boolean {
        return doSegmentsOverlap(s1p1, s1p2, s2p1, s2p2, proximityMargin);
    }

    function pathIsTooClose(
        proposedPath: { x: number; y: number }[],
        existingConnections: Connection[],
        proximityMargin: number,
        ownConnectionIdToIgnore?: string
    ): boolean {
        if (proposedPath.length < 2) return false;
        for (let i = 0; i < proposedPath.length - 1; i++) {
            const pSegStart = proposedPath[i];
            const pSegEnd = proposedPath[i + 1];
            if (Math.abs(pSegStart.x - pSegEnd.x) < 0.1 && Math.abs(pSegStart.y - pSegEnd.y) < 0.1) continue;
            for (const conn of existingConnections) {
                if (ownConnectionIdToIgnore && conn.id === ownConnectionIdToIgnore) continue;
                for (let j = 0; j < conn.path.length - 1; j++) {
                    const eSegStart = conn.path[j];
                    const eSegEnd = conn.path[j + 1];
                    if (Math.abs(eSegStart.x - eSegEnd.x) < 0.1 && Math.abs(eSegStart.y - eSegEnd.y) < 0.1) continue;
                    if (isSegmentTooClose(pSegStart, pSegEnd, eSegStart, eSegEnd, proximityMargin)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function doSegmentsOverlap(
        s1p1: { x: number; y: number }, s1p2: { x: number; y: number },
        s2p1: { x: number; y: number }, s2p2: { x: number; y: number },
        tolerance: number = LINE_THICKNESS_FOR_COLLISION
    ): boolean {
        const isS1Horizontal = Math.abs(s1p1.y - s1p2.y) < 0.1;
        const isS2Horizontal = Math.abs(s2p1.y - s2p2.y) < 0.1;
        const isS1Vertical = Math.abs(s1p1.x - s1p2.x) < 0.1;
        const isS2Vertical = Math.abs(s2p1.x - s2p2.x) < 0.1;

        if (isS1Horizontal && isS2Horizontal && Math.abs(s1p1.y - s2p1.y) < tolerance) {
            const s1MinX = Math.min(s1p1.x, s1p2.x); const s1MaxX = Math.max(s1p1.x, s1p2.x);
            const s2MinX = Math.min(s2p1.x, s2p2.x); const s2MaxX = Math.max(s2p1.x, s2p2.x);
            return Math.max(s1MinX, s2MinX) < Math.min(s1MaxX, s2MaxX) - 0.1;
        }
        if (isS1Vertical && isS2Vertical && Math.abs(s1p1.x - s2p1.x) < tolerance) {
            const s1MinY = Math.min(s1p1.y, s1p2.y); const s1MaxY = Math.max(s1p1.y, s1p2.y);
            const s2MinY = Math.min(s2p1.y, s2p2.y); const s2MaxY = Math.max(s2p1.y, s2p2.y);
            return Math.max(s1MinY, s2MinY) < Math.min(s1MaxY, s2MaxY) - 0.1;
        }
        return false; // No overlap for perpendicular or non-aligned parallel segments
    }

    function doSegmentsCross(
        s1p1: { x: number; y: number }, s1p2: { x: number; y: number },
        s2p1: { x: number; y: number }, s2p2: { x: number; y: number }
    ): boolean {
        const isS1Horizontal = Math.abs(s1p1.y - s1p2.y) < 0.1;
        const isS2Horizontal = Math.abs(s2p1.y - s2p2.y) < 0.1;
        const isS1Vertical = Math.abs(s1p1.x - s1p2.x) < 0.1;
        const isS2Vertical = Math.abs(s2p1.x - s2p2.x) < 0.1;

        // Check for a horizontal segment crossing a vertical segment
        if (isS1Horizontal && isS2Vertical) {
            const s1MinX = Math.min(s1p1.x, s1p2.x);
            const s1MaxX = Math.max(s1p1.x, s1p2.x);
            const s2MinY = Math.min(s2p1.y, s2p2.y);
            const s2MaxY = Math.max(s2p1.y, s2p2.y);
            return s1p1.y > s2MinY && s1p1.y < s2MaxY && s2p1.x > s1MinX && s2p1.x < s1MaxX;
        }

        // Check for a vertical segment crossing a horizontal segment
        if (isS1Vertical && isS2Horizontal) {
            const s1MinY = Math.min(s1p1.y, s1p2.y);
            const s1MaxY = Math.max(s1p1.y, s1p2.y);
            const s2MinX = Math.min(s2p1.x, s2p2.x);
            const s2MaxX = Math.max(s2p1.x, s2p2.x);
            return s1p1.x > s2MinX && s1p1.x < s2MaxX && s2p1.y > s1MinY && s2p1.y < s1MaxY;
        }

        return false; // Not a perpendicular crossing
    }

    function countPathCrossings(
        proposedPath: { x: number; y: number }[],
        existingConnections: Connection[],
        ownConnectionIdToIgnore?: string
    ): number {
        if (proposedPath.length < 2) return 0;
        let crossingCount = 0;

        for (let i = 0; i < proposedPath.length - 1; i++) {
            const pSegStart = proposedPath[i];
            const pSegEnd = proposedPath[i + 1];
            // Skip zero-length segments
            if (Math.abs(pSegStart.x - pSegEnd.x) < 0.1 && Math.abs(pSegStart.y - pSegEnd.y) < 0.1) continue;

            for (const conn of existingConnections) {
                if (ownConnectionIdToIgnore && conn.id === ownConnectionIdToIgnore) continue;

                for (let j = 0; j < conn.path.length - 1; j++) {
                    const eSegStart = conn.path[j];
                    const eSegEnd = conn.path[j + 1];
                    // Skip zero-length segments
                    if (Math.abs(eSegStart.x - eSegEnd.x) < 0.1 && Math.abs(eSegStart.y - eSegEnd.y) < 0.1) continue;

                    if (doSegmentsCross(pSegStart, pSegEnd, eSegStart, eSegEnd)) {
                        crossingCount++;
                    }
                }
            }
        }
        return crossingCount;
    }


    function pathCollides(
        proposedPath: { x: number; y: number }[],
        existingConnections: Connection[],
        ownConnectionIdToIgnore?: string
    ): boolean {
        if (proposedPath.length < 2) return false;
        for (let i = 0; i < proposedPath.length - 1; i++) {
            const pSegStart = proposedPath[i]; const pSegEnd = proposedPath[i + 1];
            if (Math.abs(pSegStart.x - pSegEnd.x) < 0.1 && Math.abs(pSegStart.y - pSegEnd.y) < 0.1) continue;
            for (const conn of existingConnections) {
                if (ownConnectionIdToIgnore && conn.id === ownConnectionIdToIgnore) continue;
                for (let j = 0; j < conn.path.length - 1; j++) {
                    const eSegStart = conn.path[j]; const eSegEnd = conn.path[j + 1];
                    if (Math.abs(eSegStart.x - eSegEnd.x) < 0.1 && Math.abs(eSegStart.y - eSegEnd.y) < 0.1) continue;
                    if (doSegmentsOverlap(pSegStart, pSegEnd, eSegStart, eSegEnd)) return true;
                }
            }
        }
        return false;
    }


    interface CandidatePathInfo {
        path: { x: number; y: number }[];
        length: number;
        bends: number;
        isClose: boolean;
        crossings: number;
        hardCollides: boolean;
        cost: number;
    }

    const generateManhattanPathWithAvoidance = useCallback((
        startFiber: Fiber | SplitterPort, endFiber: Fiber | SplitterPort,
        startCable: Cable, endCable: Cable,
        existingConnections: Connection[],
        canvasWidth: number, canvasHeight: number,
        connectionIdToUpdate?: string
    ): { x: number, y: number }[] => {
        const p1 = startFiber.exitPoint;
        const p2 = endFiber.exitPoint;

        const candidatePathsStorage: CandidatePathInfo[] = [];
        const centralX = canvasWidth / 2;
        const centralY = canvasHeight / 2;

        const otherFiberRects = managedCables.flatMap(cable =>
            cable.fibers
                .filter(f => f.id !== startFiber.id && f.id !== endFiber.id)
                .map(f => f.rect)
        );

        const otherCableBodyRects = managedCables
            .filter(c => c.id !== startCable.id && c.id !== endCable.id)
            .map(c => c.rect);

        const doesPathIntersectRectsList = (
            path: { x: number; y: number }[],
            rects: Array<{ x: number; y: number; width: number; height: number }>,
            margin: number
        ): boolean => {
            if (path.length < 2) return false;
            for (let i = 0; i < path.length - 1; i++) {
                const segP1 = path[i]; const segP2 = path[i + 1];
                if (Math.abs(segP1.x - segP2.x) < 0.1 && Math.abs(segP1.y - segP2.y) < 0.1) continue;
                for (const rect of rects) {
                    const irx = rect.x - margin; const iry = rect.y - margin;
                    const irw = rect.width + 2 * margin; const irh = rect.height + 2 * margin;
                    const rectRight = irx + irw; const rectBottom = iry + irh;
                    let intersects = false;
                    if (Math.abs(segP1.y - segP2.y) < 0.1) { // Horizontal path segment
                        const segY = segP1.y;
                        if (segY >= iry && segY <= rectBottom) {
                            if (Math.max(segP1.x, segP2.x) >= irx && Math.min(segP1.x, segP2.x) <= rectRight) {
                                intersects = true;
                            }
                        }
                    } else if (Math.abs(segP1.x - segP2.x) < 0.1) { // Vertical path segment
                        const segX = segP1.x;
                        if (segX >= irx && segX <= rectRight) {
                            if (Math.max(segP1.y, segP2.y) >= iry && Math.min(segP1.y, segP2.y) <= rectBottom) {
                                intersects = true;
                            }
                        }
                    }
                    if (intersects) return true;
                }
            }
            return false;
        };

        const splitterBodyRects = managedSplitters.map(splitter => {
            // Don't check for collision with the splitter we are connecting to
            if (splitter.id === startFiber.parentId || splitter.id === endFiber.parentId) {
                return null;
            }
            return getAABBOfRotatedRect(
                { width: splitter.width, height: splitter.height },
                { x: splitter.x, y: splitter.y },
                splitter.rotation
            );
        }).filter(Boolean) as { x: number; y: number; width: number; height: number }[];


        const addCandidate = (rawPath: { x: number, y: number }[]) => {
            const cleanedPath = rawPath.reduce((acc, point, index) => {
                if (index === 0 || Math.abs(point.x - acc[acc.length - 1].x) > 0.01 || Math.abs(point.y - acc[acc.length - 1].y) > 0.01) {
                    acc.push(point);
                } else if (index === rawPath.length - 1 && rawPath.length > 1 && (Math.abs(point.x - acc[acc.length - 1].x) < 0.01 && Math.abs(point.y - acc[acc.length - 1].y) < 0.01)) {
                    if (acc.length > 0) acc[acc.length - 1] = point; else acc.push(point);
                }
                return acc;
            }, [] as { x: number, y: number }[]);

            if (cleanedPath.length < 2 && (Math.abs(p1.x - p2.x) > 0.1 || Math.abs(p1.y - p2.y) > 0.1)) {
                if (cleanedPath.length === 1 && Math.abs(cleanedPath[0].x - p1.x) < 0.1 && Math.abs(cleanedPath[0].y - p1.y) < 0.1) {
                    cleanedPath.push({ ...p2 });
                } else { return; }
            }
            if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1) { // If start and end are basically same point
                if (cleanedPath.length === 0) cleanedPath.push({ ...p1 }, { ...p2 });
                else if (cleanedPath.length === 1 && Math.abs(cleanedPath[0].x - p1.x) < 0.1 && Math.abs(cleanedPath[0].y - p1.y) < 0.1) cleanedPath.push({ ...p2 });
            }
            if (cleanedPath.length < 2) return;

            let pathLength = 0;
            for (let i = 0; i < cleanedPath.length - 1; i++) {
                pathLength += Math.abs(cleanedPath[i].x - cleanedPath[i + 1].x) + Math.abs(cleanedPath[i].y - cleanedPath[i + 1].y);
            }

            let bends = 0;
            for (let i = 1; i < cleanedPath.length - 1; i++) {
                const pPrev = cleanedPath[i - 1]; const pCurr = cleanedPath[i]; const pNext = cleanedPath[i + 1];
                const dx1 = pCurr.x - pPrev.x; const dy1 = pCurr.y - pPrev.y;
                const dx2 = pNext.x - pCurr.x; const dy2 = pNext.y - pCurr.y;
                if ((Math.abs(dx1) > 0.01 && Math.abs(dy2) > 0.01) || (Math.abs(dy1) > 0.01 && Math.abs(dx2) > 0.01)) {
                    bends++;
                }
            }

            const hardCollisionWithConnection = pathCollides(cleanedPath, existingConnections, connectionIdToUpdate);
            const tooCloseToConnection = !hardCollisionWithConnection ? pathIsTooClose(cleanedPath, existingConnections, PROXIMITY_MARGIN, connectionIdToUpdate) : false;
            const intersectsOtherFibers = doesPathIntersectRectsList(cleanedPath, otherFiberRects, FIBER_AVOIDANCE_MARGIN);
            const intersectsOtherCables = doesPathIntersectRectsList(cleanedPath, otherCableBodyRects, CABLE_AVOIDANCE_MARGIN);
            const crossings = countPathCrossings(cleanedPath, existingConnections, connectionIdToUpdate);
            const intersectsSplitters = doesPathIntersectRectsList(cleanedPath, splitterBodyRects, CABLE_AVOIDANCE_MARGIN);

            let usesCentralChannel = false;
            for (let i = 0; i < cleanedPath.length - 1; i++) {
                const p1Seg = cleanedPath[i]; const p2Seg = cleanedPath[i + 1];
                if (Math.abs(p1Seg.y - p2Seg.y) < 10.1) {
                    if (Math.abs(p1Seg.y - centralY) < CENTRAL_CHANNEL_TOLERANCE) { usesCentralChannel = true; break; }
                } else if (Math.abs(p1Seg.x - p2Seg.x) < 10.1) {
                    if (Math.abs(p1Seg.x - centralX) < CENTRAL_CHANNEL_TOLERANCE) { usesCentralChannel = true; break; }
                }
            }

            let cost = pathLength + (bends * BEND_PENALTY) + (crossings * CROSSING_PENALTY);
            if (tooCloseToConnection) cost += PROXIMITY_PENALTY;
            if (hardCollisionWithConnection) cost += 100000;
            if (intersectsOtherFibers) cost += FIBER_INTERSECTION_PENALTY;
            if (intersectsOtherCables) cost += CABLE_INTERSECTION_PENALTY;
            if (usesCentralChannel) cost -= CENTRAL_CHANNEL_REWARD;
            // if (intersectsSplitters) cost += SPLITTER_INTERSECTION_PENALTY;

            candidatePathsStorage.push({
                path: cleanedPath, length: pathLength, bends: bends,
                crossings: crossings, 
                isClose: tooCloseToConnection, hardCollides: hardCollisionWithConnection, cost: cost
            });

        };

        if (Math.abs(p1.x - p2.x) < 0.1 || Math.abs(p1.y - p2.y) < 0.1) { addCandidate([p1, p2]); }
        addCandidate([p1, { x: p1.x, y: p2.y }, p2]);
        addCandidate([p1, { x: p2.x, y: p1.y }, p2]);

        const midXOverall = (p1.x + p2.x) / 2; const midYOverall = (p1.y + p2.y) / 2;
        addCandidate([{ x: p1.x, y: p1.y }, { x: midXOverall, y: p1.y }, { x: midXOverall, y: p2.y }, { x: p2.x, y: p2.y }]);
        addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: midYOverall }, { x: p2.x, y: midYOverall }, { x: p2.x, y: p2.y }]);

        function generateOffset(n: number): number[] {
            let arr = [0]
            for (let i = 1; i < n; i += 2) {
                arr[i] = Math.abs(arr[i - 1]) + 15
                arr[i + 1] = -1 * arr[i]
            }
            return arr
        }
        const offsets = generateOffset(50)
        for (const offset of offsets) {
            addCandidate([{ x: p1.x, y: p1.y }, { x: centralX + offset, y: p1.y }, { x: centralX + offset, y: p2.y }, { x: p2.x, y: p2.y }]);
            addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: centralY + offset }, { x: p2.x, y: centralY + offset }, { x: p2.x, y: p2.y }]);
        }

        const exitDistances = [CABLE_THICKNESS + 10, CABLE_THICKNESS + 30, CABLE_THICKNESS + 50];
        for (const exitDistance of exitDistances) {
            let exitP1X_strat3 = p1.x, exitP1Y_strat3 = p1.y; let tempPath_strat3: { x: number, y: number }[];
            if (startCable.orientation === 'vertical') {
                exitP1X_strat3 = p1.x + (startCable.originalType === 'in' ? exitDistance : -exitDistance);
                tempPath_strat3 = [{ x: p1.x, y: p1.y }, { x: exitP1X_strat3, y: p1.y }, { x: exitP1X_strat3, y: p2.y }, { x: p2.x, y: p2.y }];
                addCandidate(tempPath_strat3);
            } else {
                exitP1Y_strat3 = p1.y + (startCable.y < canvasHeight / 2 ? exitDistance : -exitDistance);
                tempPath_strat3 = [{ x: p1.x, y: p1.y }, { x: p1.x, y: exitP1Y_strat3 }, { x: p2.x, y: exitP1Y_strat3 }, { x: p2.x, y: p2.y }];
                addCandidate(tempPath_strat3);
            }
        }
        const intermediateChannelXs = offsets.map(o => centralX + o); const intermediateChannelYs = offsets.map(o => centralY + o);
        for (const channelX_strat4 of intermediateChannelXs) {
            for (const channelY_strat4 of intermediateChannelYs) {
                addCandidate([p1, { x: channelX_strat4, y: p1.y }, { x: channelX_strat4, y: channelY_strat4 }, { x: p2.x, y: channelY_strat4 }, p2]);
                addCandidate([p1, { x: p1.x, y: channelY_strat4 }, { x: channelX_strat4, y: channelY_strat4 }, { x: channelX_strat4, y: p2.y }, p2]);
            }
        }

        const edgePadding = 15; const edgeRoutePointsX = [edgePadding, canvasWidth - edgePadding]; const edgeRoutePointsY = [edgePadding, canvasHeight - edgePadding];
        for (const edgeX_strat5 of edgeRoutePointsX) { addCandidate([p1, { x: edgeX_strat5, y: p1.y }, { x: edgeX_strat5, y: p2.y }, p2]); }
        for (const edgeY_strat5 of edgeRoutePointsY) { addCandidate([p1, { x: p1.x, y: edgeY_strat5 }, { x: p2.x, y: edgeY_strat5 }, p2]); }


        let chosenPath: { x: number; y: number }[];
        if (candidatePathsStorage.length === 0) {
            console.warn("OpticalFiberCanvas: No candidate paths generated, creating direct fallback.");
            chosenPath = [{ ...startFiber.exitPoint }];
            if (startFiber.id !== endFiber.id) { chosenPath.push({ ...endFiber.exitPoint }); }
            else { chosenPath.push({ ...startFiber.exitPoint }); }
        } else {
            const getRandomColor = () => {
                var letters = '0123456789ABCDEF';
                var color = '#';
                for (var i = 0; i < 6; i++) {
                    color += letters[Math.floor(Math.random() * 16)];
                }
                return color;
            }
            candidatePathsStorage.sort((a, b) => a.cost - b.cost);
            // console.log("OpticalFiberCanvas: Candidate paths generated:", candidatePathsStorage);
            // console.log(candidatePathsStorage.slice(10, 11));

            // const newConnection: Connection[] = candidatePathsStorage.slice(10, 11).map((newPath) => {
            //     const color = getRandomColor();
            //     return {
            //     id: `conn-${v4()}`, fiber1Id: startFiber.id, fiber2Id: endFiber.id, path: newPath.path,
            //     color1: color, color2: color,
            //     isMarked1: false, isMarked2: true,
            // }});
            // setConnections(prev => [...prev, ...newConnection]);
            const bestPathInfo = candidatePathsStorage[0];
            chosenPath = bestPathInfo.path;
        }

        const finalPath = chosenPath.map(p => ({ ...p }));
        if (finalPath.length > 0) {
            const firstPt = finalPath[0];
            if (Math.abs(chosenPath[0].x - startFiber.exitPoint.x) < 0.01 && Math.abs(chosenPath[0].y - startFiber.exitPoint.y) < 0.01) {
                if (startCable.orientation === 'vertical') {
                    firstPt.x += (startCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                } else {
                    firstPt.y += (startCable.y < canvasHeight / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                }
            }
            if (finalPath.length > 0) {
                const lastPt = finalPath[finalPath.length - 1];
                const originalLastPt = chosenPath[chosenPath.length - 1];
                if (Math.abs(originalLastPt.x - endFiber.exitPoint.x) < 0.01 && Math.abs(originalLastPt.y - endFiber.exitPoint.y) < 0.01) {
                    if (endCable.orientation === 'vertical') {
                        lastPt.x += (endCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                    } else {
                        lastPt.y += (endCable.y < canvasHeight / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                    }
                }
            }
        }
        return finalPath;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managedCables /* To get otherFiberRects, otherCableBodyRects */]);


    function isPointInsideRectangle(pos: { x: number, y: number }, rect: { x: number, y: number, width: number, height: number }): boolean {
        return pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height;
    }

    const getMousePos = useCallback((e: React.MouseEvent | MouseEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    // --- Event Handlers ---
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);

        for (const splitter of managedSplitters) {
            // --- ADD THIS LOG to see if the check is running ---
            // console.log(`Checking splitter ${splitter.name} at x:${splitter.x}, y:${splitter.y}`);

            // Check Drag Handle
            const distDrag = Math.sqrt((pos.x - splitter.dragHandle.x) ** 2 + (pos.y - splitter.dragHandle.y) ** 2);
            if (distDrag <= splitter.dragHandle.radius + 2) {
                setDraggingSplitterInfo({ id: splitter.id, offsetX: snapToGrid(splitter.x - pos.x), offsetY: snapToGrid(splitter.y - pos.y) });
                // Set active state for immediate visual feedback
                setManagedSplitters(prev => prev.map(s => s.id === splitter.id ? { ...s, dragHandle: { ...s.dragHandle, isActive: true } } : s));
                return;
            }

            // Check Rotate Handle
            const rh = splitter.rotateHandle;
            if (pos.x >= rh.x && pos.x <= rh.x + rh.width && pos.y >= rh.y && pos.y <= rh.y + rh.height) {
                const startAngle = Math.atan2(pos.y - splitter.y, pos.x - splitter.y);
                setRotatingSplitterInfo({ id: splitter.id, startAngle, initialRotation: splitter.rotation });
                // Set active state
                setManagedSplitters(prev => prev.map(s => s.id === splitter.id ? { ...s, rotateHandle: { ...s.rotateHandle, isActive: true } } : s));
                return;
            }
        }




        if (editingConnectionId) {
            const conn = connections.find(c => c.id === editingConnectionId);
            if (conn) {
                if (conn.deleteIconRect) { // Check delete icon first
                    const delRect1 = { x: conn.path[conn.path.length - 1].x + dx - 16, y: conn.path[conn.path.length - 1].y - dy, width: conn.deleteIconRect.width, height: conn.deleteIconRect.height };
                    const delRect2 = { x: conn.path[0].x - dx, y: conn.path[0].y - dy, width: conn.deleteIconRect.width, height: conn.deleteIconRect.height };
                    if (isPointInsideRectangle(pos, delRect1) || isPointInsideRectangle(pos, delRect2)) {
                        setConnections(prev => prev.filter(c => c.id !== editingConnectionId));
                        setEditingConnectionId(null);
                        return;
                    }
                }
                for (let i = 0; i < (conn.controlPoints?.length || 0); i++) {
                    const cp = conn.controlPoints![i];
                    const dist = Math.sqrt((pos.x - cp.x) ** 2 + (pos.y - cp.y) ** 2);
                    if (dist <= CONNECTION_CONTROL_POINT_RADIUS + 2) {
                        setDraggingControlPoint({ connectionId: conn.id, pointIndex: i, offsetX: cp.x - pos.x, offsetY: cp.y - pos.y });
                        return;
                    }
                }
                if (conn.path.length >= 2) { // Check for clicking midpoint add handles
                    for (let i = 0; i < conn.path.length - 1; i++) {
                        const p1 = conn.path[i]; const p2 = conn.path[i + 1];
                        if (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) <= MIDPOINT_ADD_HANDLE_RADIUS * 4) continue;
                        const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                        const distToMidpoint = Math.sqrt((pos.x - midX) ** 2 + (pos.y - midY) ** 2);
                        if (distToMidpoint <= MIDPOINT_ADD_HANDLE_RADIUS + 2) {
                            const newPointFromClick = { x: pos.x, y: pos.y };
                            const newPath = [...conn.path.slice(0, i + 1), newPointFromClick, ...conn.path.slice(i + 1)];
                            const newPointIndex = i + 1;
                            setConnections(prevConns => prevConns.map(c =>
                                c.id === conn.id ? { ...c, path: newPath, controlPoints: newPath.map(p_ => ({ ...p_, radius: CONNECTION_CONTROL_POINT_RADIUS })) } : c
                            ));
                            setDraggingControlPoint({ connectionId: conn.id, pointIndex: newPointIndex, offsetX: newPointFromClick.x - pos.x, offsetY: newPointFromClick.y - pos.y });
                            setActivePresplice(null); setSelectedFiberId1(null);
                            return;
                        }
                    }
                }
            }
        }

        for (const cable of managedCables) {
            const dist = Math.sqrt((pos.x - cable.dragHandle.x) ** 2 + (pos.y - cable.dragHandle.y) ** 2);
            if (dist <= cable.dragHandle.radius + 2) { // Increased click radius for handle
                setDraggingCableInfo({ cableId: cable.id, offsetX: cable.x - pos.x, offsetY: cable.y - pos.y });
                setManagedCables(prev => prev.map(c => c.id === cable.id ? { ...c, dragHandle: { ...c.dragHandle, isActive: true } } : c));
                return;
            }
        }

        if (activePresplice) {
            const { x, y, size } = activePresplice.plusIconPosition;
            if (pos.x >= x - size / 2 && pos.x <= x + size / 2 && pos.y >= y - size / 2 && pos.y <= y + size / 2) {

                const point1 = getConnectionPointById(activePresplice.fiber1Id);
                const point2 = getConnectionPointById(activePresplice.fiber2Id);

                if (point1 && point2) {
                    // Find the parent of each point (could be a Cable or a Splitter)
                    const parent1 = managedCables.find(c => c.id === point1.parentId) || managedSplitters.find(s => s.id === point1.parentId);
                    const parent2 = managedCables.find(c => c.id === point2.parentId) || managedSplitters.find(s => s.id === point2.parentId);

                    if (parent1 && parent2) {
                        // This helper function "adapts" a Splitter to look like a Cable
                        // so our existing pathfinder can use it without modification.
                        const adaptToCable = (parent: Cable | SplitterState): Cable => {
                            if ('fibers' in parent) return parent; // It's already a Cable, return it.

                            // It's a Splitter, so create a temporary "dummy" Cable object.
                            return {
                                id: parent.id,
                                originalType: 'in', // These properties can be defaults
                                orientation: 'vertical',
                                x: parent.x,
                                y: parent.y,
                                // Provide default/empty properties to satisfy the Cable type
                                fibers: [],
                                rect: { x: parent.x - parent.width / 2, y: parent.y - parent.height / 2, width: parent.width, height: parent.height },
                                dragHandle: parent.dragHandle,
                                type: 'in'
                            };
                        };

                        // Generate the path using the adapted parents
                        const newPath = generateManhattanPathWithAvoidance(
                            point1 as Fiber, // Cast is safe as SplitterPort has the required properties
                            point2 as Fiber,
                            adaptToCable(parent1), // Adapt the first parent
                            adaptToCable(parent2), // Adapt the second parent
                            connections,
                            dimensions.width,
                            dimensions.height
                        );

                        // Create the final connection object
                        const newConnection: Connection = {
                            id: `conn-${Date.now()}`,
                            fiber1Id: point1.id,
                            fiber2Id: point2.id,
                            path: newPath,
                            color1: point1.originalColor,
                            color2: point2.originalColor,
                            isMarked1: point1.isMarked,
                            isMarked2: point2.isMarked,
                            controlPoints: newPath.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS }))
                        };

                        // Add the new connection to our state
                        setConnections(prev => [...prev, newConnection]);
                    }
                }

                // Reset state after creating the connection
                setActivePresplice(null);
                setSelectedFiberId1(null);
                setEditingConnectionId(null);
                return; // Important: Stop further processing of the click
            }
        }
        // 1. Create a single list of ALL connectable points.
        const allConnectablePoints: (Fiber | SplitterPort)[] = [
            ...managedCables.flatMap(c => c.fibers),
            ...managedSplitters.flatMap(s => [...s.inputs, ...s.outputs])
        ];

        // 2. Get all points that are already part of a connection.
        const connectedPointIds = new Set(connections.flatMap(c => [c.fiber1Id, c.fiber2Id]));

        // 3. Loop through the unified list to find what was clicked.
        for (const point of allConnectablePoints) {
            if (connectedPointIds.has(point.id)) continue; // Skip already connected points

            // Check if the point was clicked. We use a different method for rotated splitter ports.
            let wasClicked = false;
            if ('originalType' in point) { // It's a Fiber from a Cable
                wasClicked = isPointInsideRectangle(pos, point.rect);
            } else { // It's a SplitterPort
                // For rotated ports, a simple circular hotspot check is easiest and most reliable.
                const portCenterX = point.rect.x + point.rect.width / 2;
                const portCenterY = point.rect.y + point.rect.height / 2;
                const dist = Math.sqrt((pos.x - portCenterX) ** 2 + (pos.y - portCenterY) ** 2);
                wasClicked = dist <= SPLITTER_PORT_DIMENSION; // Use dimension as radius
            }

            if (wasClicked) {
                // THE LOGIC BELOW IS THE SAME AS YOUR ORIGINAL FIBER-ONLY LOGIC
                // It works perfectly now because `getConnectionPointById` is generic.
                if (!selectedFiberId1) {
                    // This is the first point selected. Highlight it.
                    setSelectedFiberId1(point.id);
                    setEditingConnectionId(null);
                    setActivePresplice(null);
                } else if (selectedFiberId1 !== point.id) {
                    // This is the second point. Create a presplice.
                    const firstPoint = getConnectionPointById(selectedFiberId1);
                    if (firstPoint) {
                        setActivePresplice({
                            fiber1Id: firstPoint.id,
                            fiber2Id: point.id,
                            lineStart: firstPoint.exitPoint,
                            lineEnd: point.exitPoint,
                            plusIconPosition: {
                                x: (firstPoint.exitPoint.x + point.exitPoint.x) / 2,
                                y: (firstPoint.exitPoint.y + point.exitPoint.y) / 2,
                                size: PRESPLICE_PLUS_SIZE,
                            }
                        });
                    }
                }
                return; // Stop after handling the click
            }
        }
        setSelectedFiberId1(null); setActivePresplice(null); setEditingConnectionId(null);

        const connectedFiberIds = new Set(connections.flatMap(c => [c.fiber1Id, c.fiber2Id]));
        for (const cable of managedCables) {
            for (const fiber of cable.fibers) {
                if (connectedFiberIds.has(fiber.id)) continue;
                if (isPointInsideRectangle(pos, fiber.rect)) {
                    if (!selectedFiberId1) {
                        setSelectedFiberId1(fiber.id); setActivePresplice(null); setEditingConnectionId(null);
                    } else if (selectedFiberId1 !== fiber.id) {
                        const firstFiber = getConnectionPointById(selectedFiberId1);
                        if (firstFiber) {
                            setActivePresplice({
                                fiber1Id: selectedFiberId1, fiber2Id: fiber.id,
                                lineStart: firstFiber.exitPoint, lineEnd: fiber.exitPoint,
                                plusIconPosition: {
                                    x: (firstFiber.exitPoint.x + fiber.exitPoint.x) / 2,
                                    y: (firstFiber.exitPoint.y + fiber.exitPoint.y) / 2,
                                    size: PRESPLICE_PLUS_SIZE,
                                }
                            });
                        }
                    }
                    return;
                }
            }
        }

        for (const conn of connections) {
            for (let i = 0; i < conn.path.length - 1; i++) {
                const p1 = conn.path[i]; const p2 = conn.path[i + 1];
                const distToLine = Math.abs((p2.y - p1.y) * pos.x - (p2.x - p1.x) * pos.y + p2.x * p1.y - p2.y * p1.x) /
                    Math.sqrt((p2.y - p1.y) ** 2 + (p2.x - p1.x) ** 2);
                const withinBounds = (Math.min(p1.x, p2.x) - 5 <= pos.x && pos.x <= Math.max(p1.x, p2.x) + 5) &&
                    (Math.min(p1.y, p2.y) - 5 <= pos.y && pos.y <= Math.max(p1.y, p2.y) + 5);
                if (distToLine < 5 && withinBounds) {
                    setEditingConnectionId(conn.id);
                    setConnections(prevConns => prevConns.map(c => c.id === conn.id ? {
                        ...c,
                        controlPoints: c.path.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS })),
                        deleteIconRect: {
                            x: c.path[Math.floor(c.path.length / 2)].x - DELETE_ICON_SIZE / 2, // Simplified position
                            y: c.path[Math.floor(c.path.length / 2)].y - DELETE_ICON_SIZE / 2,
                            width: DELETE_ICON_SIZE, height: DELETE_ICON_SIZE,
                        }
                    } : c));
                    setSelectedFiberId1(null); setActivePresplice(null);
                    return;
                }
            }
        }
        setSelectedFiberId1(null); setActivePresplice(null); setEditingConnectionId(null);
    }, [
        managedCables,
        getMousePos,
        activePresplice,
        selectedFiberId1,
        managedCables,
        managedSplitters,
        connections,
        getConnectionPointById,
        activePresplice,
        selectedFiberId1,
        connections,
        editingConnectionId,
        getConnectionPointById,
        getCableById,
        generateManhattanPathWithAvoidance,
        dimensions.width, dimensions.height,
        getMousePos
    ]);


    const updateAttachedConnections = useCallback((parentId: string) => {
        setConnections(prevConns => prevConns.map(conn => {
            const point1 = getConnectionPointById(conn.fiber1Id);
            const point2 = getConnectionPointById(conn.fiber2Id);

            // Check if this connection is attached to the item that moved/rotated
            if ((point1 && point1.parentId === parentId) || (point2 && point2.parentId === parentId)) {
                const parent1 = managedCables.find(c => c.id === point1?.parentId) || managedSplitters.find(s => s.id === point1?.parentId);
                const parent2 = managedCables.find(c => c.id === point2?.parentId) || managedSplitters.find(s => s.id === point2?.parentId);

                if (point1 && point2 && parent1 && parent2) {
                    // "Adapt" a splitter to look like a cable for the pathfinder function
                    const adaptToCable = (parent: Cable | SplitterState): Cable => {
                        if ('fibers' in parent) return parent; // It's already a Cable
                        // It's a Splitter, create a dummy Cable-like object
                        return {
                            id: parent.id,
                            originalType: 'in',
                            orientation: 'vertical', // Pathfinding doesn't strictly need this for a splitter
                            x: parent.x,
                            y: parent.y,
                            // Provide empty properties to satisfy the type
                            fibers: [],
                            rect: { x: parent.x, y: parent.y, width: parent.width, height: parent.height },
                            dragHandle: parent.dragHandle,
                            type: 'in'
                        };
                    };

                    const newPath = generateManhattanPathWithAvoidance(
                        point1 as Fiber, // Cast is safe because they share the connectable properties
                        point2 as Fiber,
                        adaptToCable(parent1),
                        adaptToCable(parent2),
                        prevConns.filter(c => c.id !== conn.id),
                        dimensions.width,
                        dimensions.height,
                        conn.id
                    );
                    return { ...conn, path: newPath, controlPoints: newPath.map(p => ({ ...p, radius: 4 })) };
                }
            }
            return conn;
        }));
    }, [getConnectionPointById, managedCables, managedSplitters, generateManhattanPathWithAvoidance, dimensions]);

    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => { // Allow MouseEvent for window listener
        const pos = getMousePos(e);

        if (draggingSplitterInfo) {
            let movedSplitterId: string | null = null;

            // 1. Update the splitter's position
            setManagedSplitters(prevSplitters => {
                const newSplitters = prevSplitters.map(s => {
                    if (s.id === draggingSplitterInfo.id) {
                        movedSplitterId = s.id;
                        return { ...s, x: snapToGrid(pos.x) + draggingSplitterInfo.offsetX, y: snapToGrid(pos.y) - 2.5 + draggingSplitterInfo.offsetY };
                    }
                    return s;
                });
                // 2. Recalculate layout to update port/handle positions
                return calculateSplitterLayout(newSplitters);
            });

            // 3. Regenerate paths for connections attached to the moved splitter
            if (movedSplitterId) {
                updateAttachedConnections(movedSplitterId);
            }
            return; // Done
        }

        // --- Logic for rotating a Splitter ---
        if (rotatingSplitterInfo) {
            const splitter = managedSplitters.find(s => s.id === rotatingSplitterInfo.id);
            if (splitter) {
                const currentAngle = Math.atan2(pos.y - splitter.y, pos.x - splitter.x);
                const deltaAngle = currentAngle - rotatingSplitterInfo.startAngle;
                const newRotation = rotatingSplitterInfo.initialRotation + deltaAngle;

                // 1. Update the splitter's rotation
                setManagedSplitters(prevSplitters => {
                    const newSplitters = prevSplitters.map(s =>
                        s.id === rotatingSplitterInfo.id ? { ...s, rotation: newRotation } : s
                    );
                    // 2. Recalculate layout to update port exitPoints based on new rotation
                    return calculateSplitterLayout(newSplitters);
                });

                // 3. Regenerate paths for attached connections
                // updateAttachedConnections(rotatingSplitterInfo.id);
            }
            return; // Done
        }

        if (draggingCableInfo) {
            setManagedCables(prevCables => {
                let newCablesArr = prevCables.map(c => {
                    if (c.id === draggingCableInfo.cableId) {
                        let newX = snapToGrid(pos.x + draggingCableInfo.offsetX);
                        let newY = snapToGrid(pos.y + draggingCableInfo.offsetY);

                        let newOrientation = c.orientation;

                        const currentVisualWidth = c.rect.width; // Use actual calculated width
                        const currentVisualHeight = c.rect.height; // Use actual calculated height

                        if (c.orientation === 'vertical') {
                            if (newY < -EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'horizontal'; newY = snapToGrid(CANVAS_PADDING / 2);
                                newX = Math.max(0, Math.min(dimensions.width - currentVisualHeight, newX)); // width becomes height
                            } else if (newY + currentVisualHeight > dimensions.height + EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'horizontal'; newY = snapToGrid(dimensions.height - CABLE_THICKNESS - CANVAS_PADDING / 2);
                                newX = Math.max(0, Math.min(dimensions.width - currentVisualHeight, newX)); // width becomes height
                            }
                        } else { // Horizontal
                            if (newX < -EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'vertical'; newX = snapToGrid(CANVAS_PADDING / 2);
                                newY = Math.max(0, Math.min(dimensions.height - currentVisualWidth, newY)); // height becomes width
                            } else if (newX + currentVisualWidth > dimensions.width + EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'vertical'; newX = snapToGrid(dimensions.width - CABLE_THICKNESS - CANVAS_PADDING / 2);
                                newY = Math.max(0, Math.min(dimensions.height - currentVisualWidth, newY)); // height becomes width
                            }
                        }
                        // Basic overlap prevention with other static cables
                        const draggedCableProjectedRect = {
                            x: newX, y: newY,
                            width: newOrientation === c.orientation ? currentVisualWidth : currentVisualHeight, // Adjust for potential orientation change
                            height: newOrientation === c.orientation ? currentVisualHeight : currentVisualWidth
                        };

                        const isOverlapping = prevCables.some(otherCable => {
                            if (otherCable.id !== c.id && !otherCable.isDragging) { // Check against non-dragged cables
                                const otherRect = otherCable.rect;
                                return (
                                    draggedCableProjectedRect.x < otherRect.x + otherRect.width &&
                                    draggedCableProjectedRect.x + draggedCableProjectedRect.width > otherRect.x &&
                                    draggedCableProjectedRect.y < otherRect.y + otherRect.height &&
                                    draggedCableProjectedRect.y + draggedCableProjectedRect.height > otherRect.y
                                );
                            }
                            return false;
                        });

                        if (!isOverlapping) {
                            return { ...c, x: newX, y: newY, orientation: newOrientation, isDragging: true };
                        } else {
                            // If overlapping, don't update position but keep dragging state
                            return { ...c, isDragging: true };
                        }
                    }
                    return { ...c, isDragging: false }; // Ensure other cables are not marked as dragging
                });
                // Recalculate layout for ALL cables, as one cable's change might affect others or connection lines
                const reLayoutedCables = calculateLayout(newCablesArr.map(nc => ({ ...nc, isDragging: draggingCableInfo?.cableId === nc.id })));

                // Update connections based on new cable/fiber positions
                // setConnections(prevConns => prevConns.map(conn => {
                //     const fiber1 = reLayoutedCables.flatMap(ca => ca.fibers).find(f => f.id === conn.fiber1Id);
                //     const fiber2 = reLayoutedCables.flatMap(ca => ca.fibers).find(f => f.id === conn.fiber2Id);
                //     const cable1 = reLayoutedCables.find(ca => ca.id === fiber1?.parentId);
                //     const cable2 = reLayoutedCables.find(ca => ca.id === fiber2?.parentId);

                //     if (fiber1 && fiber2 && cable1 && cable2) {
                //         const newPath = generateManhattanPathWithAvoidance(fiber1, fiber2, cable1, cable2, prevConns.filter(c => c.id !== conn.id), dimensions.width, dimensions.height, conn.id);
                //         let updatedConn = { ...conn, path: newPath };
                //         if (editingConnectionId === conn.id) { // If it was being edited, update its CPs too
                //             updatedConn.controlPoints = newPath.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS }));
                //             // Keep deleteIconRect logic if needed, or simplify
                //         }
                //         return updatedConn;
                //     }
                //     return conn; // Return original connection if fibers/cables not found
                // }));
                return reLayoutedCables;
            });

        } else if (draggingControlPoint) {
            setConnections(prevConns => prevConns.map(conn => {
                if (conn.id === draggingControlPoint.connectionId) {
                    const currentPath = [...conn.path];
                    const pointIndex = draggingControlPoint.pointIndex;
                    if (pointIndex < 0 || pointIndex >= currentPath.length) return conn;

                    let newPointX = snapToGrid(pos.x + draggingControlPoint.offsetX);
                    let newPointY = snapToGrid(pos.y + draggingControlPoint.offsetY);
                    newPointX = snapToGrid(Math.max(0, Math.min(dimensions.width, newPointX)));
                    newPointY = snapToGrid(Math.max(0, Math.min(dimensions.height, newPointY)));
                    const draggedPoint = { x: e.altKey ? currentPath[pointIndex].x : newPointX, y: e.shiftKey ? currentPath[pointIndex].y : newPointY };
                    currentPath[pointIndex] = draggedPoint;

                    const fiber1 = getConnectionPointById(conn.fiber1Id); const fiber2 = getConnectionPointById(conn.fiber2Id);
                    const startCable = getCableById(fiber1?.parentId); const endCable = getCableById(fiber2?.parentId);

                    if (pointIndex !== 0 && fiber1 && startCable) {
                        let f1Exit = { ...fiber1.exitPoint };
                        if (startCable.orientation === 'vertical') f1Exit.x += (startCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                        else f1Exit.y += (startCable.y < dimensions.height / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                        currentPath[0] = f1Exit;
                    }
                    if (pointIndex !== currentPath.length - 1 && fiber2 && endCable) {
                        let f2Exit = { ...fiber2.exitPoint };
                        if (endCable.orientation === 'vertical') f2Exit.x += (endCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                        else f2Exit.y += (endCable.y < dimensions.height / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                        currentPath[currentPath.length - 1] = f2Exit;
                    }

                    const simplifiedPath = currentPath.reduce((acc, p, idx) => {
                        if (idx === 0 || Math.abs(p.x - acc[acc.length - 1].x) > 0.01 || Math.abs(p.y - acc[acc.length - 1].y) > 0.01) acc.push(p);
                        else if (idx === currentPath.length - 1) acc.push(p); // Keep last point
                        return acc;
                    }, [] as { x: number, y: number }[]);

                    let finalPathForConnection = simplifiedPath;
                    if (finalPathForConnection.length === 0 && currentPath.length > 0) finalPathForConnection = [currentPath[0]];
                    if (finalPathForConnection.length === 1 && fiber1 && fiber2 && fiber1.id !== fiber2.id && currentPath.length > 1) {
                        const safePath = [currentPath[0]];
                        if (currentPath.length > 1) safePath.push(currentPath[currentPath.length - 1]);
                        finalPathForConnection = safePath.reduce((acc, p, idx) => {
                            if (idx === 0 || Math.abs(p.x - acc[acc.length - 1].x) > 0.01 || Math.abs(p.y - acc[acc.length - 1].y) > 0.01) acc.push(p);
                            return acc;
                        }, [] as { x: number, y: number }[]);
                        if (finalPathForConnection.length === 0) finalPathForConnection = [draggedPoint];
                    }

                    return { ...conn, path: finalPathForConnection, controlPoints: finalPathForConnection.map(p_ => ({ ...p_, radius: CONNECTION_CONTROL_POINT_RADIUS })) };
                }
                return conn;
            }));
        }
    }, [draggingCableInfo, draggingControlPoint, dimensions.width, dimensions.height, calculateLayout, getConnectionPointById, getCableById, getMousePos, editingConnectionId, generateManhattanPathWithAvoidance, connections]); // Added connections to deps for generateManhattan...

    const handleMouseUp = useCallback(() => {
        if (draggingCableInfo) {
            setManagedCables(prev => prev.map(c => c.id === draggingCableInfo.cableId ? { ...c, dragHandle: { ...c.dragHandle, isActive: false }, isDragging: false } : c));
        }
        setDraggingCableInfo(null);
        setDraggingControlPoint(null);
        setDraggingSplitterInfo(null);
        setRotatingSplitterInfo(null);
    }, [draggingCableInfo]);

    // Attach mouse move and up to window to handle dragging outside canvas
    useEffect(() => {
        const handleMouseMoveEvent = (e: MouseEvent) => handleMouseMove(e);
        const handleMouseUpEvent = (e: MouseEvent) => handleMouseUp();

        // Check if ANY drag or rotate operation is active
        if (draggingCableInfo || draggingControlPoint || draggingSplitterInfo || rotatingSplitterInfo) {
            window.addEventListener('mousemove', handleMouseMoveEvent);
            window.addEventListener('mouseup', handleMouseUpEvent);
        } else {
            // IMPORTANT: This else block cleans up listeners when no drag is active.
            window.removeEventListener('mousemove', handleMouseMoveEvent);
            window.removeEventListener('mouseup', handleMouseUpEvent);
        }

        // Final cleanup when the component unmounts
        return () => {
            window.removeEventListener('mousemove', handleMouseMoveEvent);
            window.removeEventListener('mouseup', handleMouseUpEvent);
        };
    }, [
        // The dependency array MUST include ALL of these states and handlers.
        // This tells React to re-run this logic whenever one of them changes.
        draggingCableInfo,
        draggingControlPoint,
        draggingSplitterInfo,
        rotatingSplitterInfo,
        handleMouseMove,
        handleMouseUp
    ]);


    return (
        <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            // MouseMove and MouseUp are handled by window listeners when dragging
            // onMouseMove={handleMouseMove} // Only if not dragging window-wide
            // onMouseUp={handleMouseUp}     // Only if not dragging window-wide
            // onMouseLeave={handleMouseUp} // Still useful if not using window listeners for up
            style={{ border: '1px solid #ccc', background: 'rgb(216 216 216)', touchAction: 'none' }}
        />
    );
};

export default OpticalFiberCanvas;

// Dummy helper function if not provided
// const save2DConnectionsToLocalStorage = (connections: Connection[]) => {
//  localStorage.setItem('connections2D', JSON.stringify(connections));
// };
