import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- TypeScript Interfaces ---
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

// --- Constants ---
const CABLE_THICKNESS = 50; // Width for vertical cables, Height for horizontal
const FIBER_DIMENSION_PARALLEL = 20;    // Width for fibers in vertical cable, Height for fibers in horizontal cable
const FIBER_DIMENSION_PERPENDICULAR = 10; // Height for fibers in vertical cable, Width for fibers in horizontal cable
const FIBER_SPACING = 4; // Gap between fibers
const DRAG_HANDLE_RADIUS = 5;
const DRAG_HANDLE_OFFSET = 8; // Offset from the corner for the dot
const CANVAS_PADDING = 0;
const PRESPLICE_PLUS_SIZE = 14;
const CONNECTION_CONTROL_POINT_RADIUS = 4;
const DELETE_ICON_SIZE = 16;
const EDGE_TRANSFORM_THRESHOLD = 30; // How far to drag past edge to transform
const CONNECTION_LINE_WIDTH = 6
const LINE_THICKNESS_FOR_COLLISION = 1;
// Add these near your other constants
const BEND_PENALTY = 30; // Arbitrary cost equivalent to 30px of length for each bend
const PROXIMITY_PENALTY = 60; // Arbitrary cost if a path is too close to another
const PROXIMITY_MARGIN = LINE_THICKNESS_FOR_COLLISION + 1; // How close is "too close". Must be > LINE_THICKNESS_FOR_COLLISION
const cableVerticalSpacing = 20;

// const FIBER_AVOIDANCE_MARGIN = 0.001; // Margin around fibers that paths should avoid. Adjust as needed.
// const FIBER_INTERSECTION_PENALTY = 50000; // Heavy penalty for paths crossing fibers.

// const CENTRAL_CHANNEL_TOLERANCE = 5;     // How close a path segment's Y/X needs to be to centralY/centralX.
// const CENTRAL_CHANNEL_REWARD = (2 * BEND_PENALTY) + 10;
const CONNECTION_VISUAL_OFFSET = 10; // The "plus 1" offset

// const CABLE_AVOIDANCE_MARGIN = 4;         // Margin around unrelated cable bodies.
// const CABLE_INTERSECTION_PENALTY = 40000; // Penalty for paths crossing unrelated cable bodies.
const FIBER_AVOIDANCE_MARGIN = 8;
const FIBER_INTERSECTION_PENALTY = 5000000;
const CABLE_AVOIDANCE_MARGIN = 4;
const CABLE_INTERSECTION_PENALTY = 40000;
const CENTRAL_CHANNEL_TOLERANCE = 5;
const CENTRAL_CHANNEL_REWARD = (2 * BEND_PENALTY) + 10; // e.g., 70 if BEND_PENALTY is 30
const MIDPOINT_ADD_HANDLE_RADIUS = 4; // Slightly smaller than main control points
const MIDPOINT_ADD_HANDLE_COLOR = 'rgba(0, 180, 0, 0.8)'; // A distinct green


const OpticalFiberCanvas: React.FC<OpticalCanvasProps> = ({
    initialCables,
    width = 1000,
    height = 700,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [managedCables, setManagedCables] = useState<Cable[]>([]);
    const [selectedFiberId1, setSelectedFiberId1] = useState<string | null>(null);
    const [activePresplice, setActivePresplice] = useState<Presplice | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [draggingCableInfo, setDraggingCableInfo] = useState<{ cableId: string; offsetX: number; offsetY: number } | null>(null);
    const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
    const [draggingControlPoint, setDraggingControlPoint] = useState<{ connectionId: string; pointIndex: number; offsetX: number; offsetY: number } | null>(null);
    console.log(connections);

    const getFiberById = useCallback((fiberId: string): Fiber | undefined => {
        for (const cable of managedCables) {
            const fiber = cable.fibers.find(f => f.id === fiberId);
            if (fiber) return fiber;
        }
        return undefined;
    }, [managedCables]);

    const getCableByFiberId = useCallback((fiberId: string): Cable | undefined => {
        return managedCables.find(c => c.id === `${fiberId.split('-')[0]}-${fiberId.split('-')[1]}`);
    }, [managedCables]);

    // --- Initialization and Layout Calculation ---
    const calculateLayout = useCallback((cablesToLayout: Cable[]): Cable[] => {
        return cablesToLayout.map(cable => {
            let cableX = cable.x;
            let cableY = cable.y;
            let cableWidth = 0;
            let cableHeight = 0;

            if (cable.orientation === 'vertical') {
                cableWidth = CABLE_THICKNESS;
                cableHeight = cable.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING; // Added padding
                if (cable.originalType === 'in') { // Left edge
                    cableX = Math.max(0, Math.min(width - cableWidth, cable.x));
                } else { // Right edge
                    cableX = Math.max(0, Math.min(width - cableWidth, cable.x));
                }
                cableY = Math.max(0, Math.min(height - cableHeight, cable.y));
            } else { // Horizontal
                cableHeight = CABLE_THICKNESS;
                cableWidth = cable.fibers.length * (FIBER_DIMENSION_PARALLEL + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;
                if (cable.y < height / 2) { // Top edge
                    cableY = Math.max(0, Math.min(height - cableHeight, cable.y));
                } else { // Bottom edge
                    cableY = Math.max(0, Math.min(height - cableHeight, cable.y));
                }
                cableX = Math.max(0, Math.min(width - cableWidth, cable.x));
            }

            const updatedFibers = cable.fibers.map((fiber, index) => {
                let fx, fy, fwidth, fheight, exitX, exitY;
                if (cable.orientation === 'vertical') {
                    fwidth = FIBER_DIMENSION_PARALLEL;
                    fheight = FIBER_DIMENSION_PERPENDICULAR;
                    fy = cableY + FIBER_SPACING + index * (fheight + FIBER_SPACING);
                    if (cable.originalType === 'in') { // Fibers on the right of the cable
                        fx = cableX + cableWidth;
                        exitX = fx + fwidth;
                    } else { // Fibers on the left of the cable
                        fx = cableX - fwidth;
                        exitX = fx;
                    }
                    exitY = fy + fheight / 2;
                } else { // Horizontal cable
                    fwidth = FIBER_DIMENSION_PERPENDICULAR; // Visually, these are wider along the cable
                    fheight = FIBER_DIMENSION_PARALLEL;   // And thinner perpendicular
                    fx = cableX + FIBER_SPACING + index * (fwidth + FIBER_SPACING);
                    if (cable.y < height / 2) { // Top edge, fibers below
                        fy = cableY + cableHeight;
                        exitY = fy + fheight;
                    } else { // Bottom edge, fibers above
                        fy = cableY - fheight;
                        exitY = fy;
                    }
                    exitX = fx + fwidth / 2;
                }
                return { ...fiber, rect: { x: fx, y: fy, width: fwidth, height: fheight }, exitPoint: { x: exitX, y: exitY } };
            });

            let dhx, dhy; // Drag handle position
            if (cable.orientation === 'vertical') {
                // Top-right corner of the cable body for 'in', top-left for 'out'
                dhx = (cable.originalType === 'in') ? cableX + cableWidth - DRAG_HANDLE_OFFSET : cableX + DRAG_HANDLE_OFFSET;
                dhy = cableY + DRAG_HANDLE_OFFSET;
            } else { // Horizontal
                // Top-right corner of the cable body
                dhx = cableX + cableWidth - DRAG_HANDLE_OFFSET;
                dhy = (cable.y < height / 2) ? cableY + DRAG_HANDLE_OFFSET : cableY + cableHeight - DRAG_HANDLE_OFFSET;
            }


            return { ...cable, fibers: updatedFibers, rect: { x: cableX, y: cableY, width: cableWidth, height: cableHeight }, dragHandle: { x: dhx, y: dhy, radius: DRAG_HANDLE_RADIUS } };
        });
    }, [width, height]);

    useEffect(() => {
        const processedCablesForLayout: Cable[] = [];

        // Use these to track the bottom Y-coordinate of the last placed cable on each side
        let currentInCableBottomY = CANVAS_PADDING - cableVerticalSpacing; // Start so first cable's top is at CANVAS_PADDING
        let currentOutCableBottomY = CANVAS_PADDING - cableVerticalSpacing;

        initialCables.forEach((c, index) => {
            const cableId = `${index}-${c.type}`; // ID based on original index and type
            const orientation: 'vertical' | 'horizontal' = 'vertical';
            const numFibers = c.fibers.length;

            // Estimate height for initial placement. calculateLayout will determine the final rect.height.
            const estimatedCableVisualHeight =
                numFibers * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING) -
                FIBER_SPACING +
                2 * FIBER_SPACING;

            let initialX = 0;
            let initialY = 0;

            if (c.type === 'in') {
                initialX = CANVAS_PADDING;
                initialY = currentInCableBottomY + cableVerticalSpacing;
                currentInCableBottomY = initialY + estimatedCableVisualHeight; // Update for the next 'in' cable
            } else { // c.type === 'out'
                initialX = width - CABLE_THICKNESS - CANVAS_PADDING;
                initialY = currentOutCableBottomY + cableVerticalSpacing;
                currentOutCableBottomY = initialY + estimatedCableVisualHeight; // Update for the next 'out' cable
            }

            processedCablesForLayout.push({
                id: cableId,
                originalType: c.type,
                fibers: c.fibers.map((f, fIndex) => ({
                    id: `${cableId}-${fIndex}`,
                    originalColor: f.color,
                    isMarked: f.isMarked,
                    rect: { x: 0, y: 0, width: 0, height: 0 }, // To be calculated by calculateLayout
                    exitPoint: { x: 0, y: 0 }, // To be calculated by calculateLayout
                    cableId: cableId,
                })),
                x: initialX,
                y: initialY,
                orientation: orientation,
                // Provide initial estimates for rect, especially height, for calculateLayout if it uses it
                // or ensure calculateLayout recalculates width/height purely from fiber count and orientation.
                // The current calculateLayout correctly recalculates width/height.
                rect: { x: initialX, y: initialY, width: (orientation === 'vertical' ? CABLE_THICKNESS : estimatedCableVisualHeight), height: (orientation === 'vertical' ? estimatedCableVisualHeight : CABLE_THICKNESS) },
                dragHandle: { x: 0, y: 0, radius: DRAG_HANDLE_RADIUS }, // To be calculated
            });
        });

        setManagedCables(calculateLayout(processedCablesForLayout));
    }, [initialCables, width, height, calculateLayout]);


    // --- Drawing Functions ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);



        // Draw Cables and Fibers (existing logic)
        managedCables.forEach(cable => {
            // ... (keep existing cable and fiber drawing logic)
            ctx.fillStyle = 'black';
            ctx.fillRect(cable.rect.x, cable.rect.y, cable.rect.width, cable.rect.height);

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

        // Draw Presplice (existing logic)
        if (activePresplice) {
            // ... (keep existing presplice drawing logic)
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

        // Draw Connections
        connections.forEach(conn => {
            const fiber1 = getFiberById(conn.fiber1Id);
            const fiber2 = getFiberById(conn.fiber2Id);
            if (!fiber1 || !fiber2 || conn.path.length === 0) return;

            // ... (drawing "plugs" and main path segments - keep as is)
            ctx.lineWidth = CONNECTION_LINE_WIDTH;

            // Draw "plugs"
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

            // Draw main path segments (first half, second half, marks)
            // ... (This extensive logic for drawing the two-color path and marks should remain as is)
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
                        const pathForMarks = conn.path.slice(secondHalfStartIndex);
                        if (pathForMarks.length > 1) { drawMarksOnPath(ctx, pathForMarks, conn.color2); }
                    }
                }
            }


            // Draw editing adorners if this connection is being edited
            if (editingConnectionId === conn.id) {
                // Draw existing vertex control points (draggable vertices)
                conn.controlPoints?.forEach(cp => {
                    ctx.beginPath();
                    ctx.arc(cp.x, cp.y, CONNECTION_CONTROL_POINT_RADIUS, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(0,0,255,0.7)'; // Blue for vertex points
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,150,0.9)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });

                // --- NEW: Draw midpoint "add" handles ---
                if (conn.path.length >= 2) { // Need at least one segment
                    for (let i = 0; i < conn.path.length - 1; i++) {
                        const p1 = conn.path[i];
                        const p2 = conn.path[i + 1];
                        // Don't draw add handle if segment is too short (prevents clutter)
                        if (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) > MIDPOINT_ADD_HANDLE_RADIUS * 4) {
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;

                            ctx.beginPath();
                            ctx.arc(midX, midY, MIDPOINT_ADD_HANDLE_RADIUS, 0, 2 * Math.PI);
                            ctx.fillStyle = MIDPOINT_ADD_HANDLE_COLOR; // Green for add points
                            ctx.fill();
                            ctx.strokeStyle = 'rgba(0,100,0,0.9)';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
                // --- END NEW ---

                // Draw delete icon (as before)
                if (conn.deleteIconRect) {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(conn.deleteIconRect.x, conn.deleteIconRect.y, conn.deleteIconRect.width, conn.deleteIconRect.height);
                    // ... (rest of delete icon drawing)
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(conn.deleteIconRect.x + 4, conn.deleteIconRect.y + 4);
                    ctx.lineTo(conn.deleteIconRect.x + conn.deleteIconRect.width - 4, conn.deleteIconRect.y + conn.deleteIconRect.height - 4);
                    ctx.moveTo(conn.deleteIconRect.x + conn.deleteIconRect.width - 4, conn.deleteIconRect.y + 4);
                    ctx.lineTo(conn.deleteIconRect.x + 4, conn.deleteIconRect.y + conn.deleteIconRect.height - 4);
                    ctx.stroke();
                }
            }
        });
    }, [managedCables, connections, activePresplice, selectedFiberId1, editingConnectionId, width, height, getFiberById /* drawMarksOnPath should be stable or in useCallback if it depends on state/props */]);

    const drawMarksOnPath = (ctx: CanvasRenderingContext2D, path: { x: number, y: number }[], color: string) => {
        ctx.strokeStyle = 'black'; // Marks are black
        ctx.lineWidth = 1;
        const markLength = 4; // Length of the small mark lines
        const markSpacing = 8; // Spacing along the path segment for marks

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            const numMarks = Math.floor(segmentLength / markSpacing);

            for (let j = 1; j <= numMarks; j++) {
                const t = (j * markSpacing) / segmentLength;
                const x = p1.x + t * dx;
                const y = p1.y + t * dy;

                ctx.beginPath();
                // Marks are always horizontal, as per interpretation
                ctx.moveTo(x, y - markLength / 2);
                ctx.lineTo(x, y + markLength / 2);
                ctx.stroke();
            }
        }
    };

    useEffect(() => {
        draw();
    }, [draw]);


    function isSegmentTooClose( // Essentially doSegmentsOverlap with a larger margin
        s1p1: { x: number; y: number }, s1p2: { x: number; y: number },
        s2p1: { x: number; y: number }, s2p2: { x: number; y: number },
        proximityMargin: number
    ): boolean {
        // Re-using doSegmentsOverlap logic with the passed proximityMargin
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
            const s1MinX = Math.min(s1p1.x, s1p2.x);
            const s1MaxX = Math.max(s1p1.x, s1p2.x);
            const s2MinX = Math.min(s2p1.x, s2p2.x);
            const s2MaxX = Math.max(s2p1.x, s2p2.x);
            return Math.max(s1MinX, s2MinX) < Math.min(s1MaxX, s2MaxX) - 0.1; // -0.1 to ensure actual overlap
        }

        if (isS1Vertical && isS2Vertical && Math.abs(s1p1.x - s2p1.x) < tolerance) {
            const s1MinY = Math.min(s1p1.y, s1p2.y);
            const s1MaxY = Math.max(s1p1.y, s1p2.y);
            const s2MinY = Math.min(s2p1.y, s2p2.y);
            const s2MaxY = Math.max(s2p1.y, s2p2.y);
            return Math.max(s1MinY, s2MinY) < Math.min(s1MaxY, s2MaxY) - 0.1; // -0.1 to ensure actual overlap
        }
        return false;
    }

    function pathCollides(
        proposedPath: { x: number; y: number }[],
        existingConnections: Connection[],
        ownConnectionIdToIgnore?: string // To avoid checking a connection against itself when updating it
    ): boolean {
        if (proposedPath.length < 2) return false;

        for (let i = 0; i < proposedPath.length - 1; i++) {
            const pSegStart = proposedPath[i];
            const pSegEnd = proposedPath[i + 1];

            if (Math.abs(pSegStart.x - pSegEnd.x) < 0.1 && Math.abs(pSegStart.y - pSegEnd.y) < 0.1) continue; // Skip zero-length segments

            for (const conn of existingConnections) {
                if (ownConnectionIdToIgnore && conn.id === ownConnectionIdToIgnore) continue;
                for (let j = 0; j < conn.path.length - 1; j++) {
                    const eSegStart = conn.path[j];
                    const eSegEnd = conn.path[j + 1];
                    if (Math.abs(eSegStart.x - eSegEnd.x) < 0.1 && Math.abs(eSegStart.y - eSegEnd.y) < 0.1) continue; // Skip zero-length segments

                    if (doSegmentsOverlap(pSegStart, pSegEnd, eSegStart, eSegEnd)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // --- Manhattan Path Generation ---
    interface CandidatePathInfo {
        path: { x: number; y: number }[];
        length: number;
        bends: number;
        isClose: boolean;
        hardCollides: boolean;
        cost: number;
    }

    // Replace your existing generateManhattanPathWithAvoidance with this one:

    const generateManhattanPathWithAvoidance = (
        startFiber: Fiber, endFiber: Fiber,
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

        // This function relies on `managedCables` being accessible from its scope.
        // If `generateManhattanPathWithAvoidance` is memoized with `useCallback`,
        // `managedCables` should be in its dependency array.

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
                const segP1 = path[i];
                const segP2 = path[i + 1];

                if (Math.abs(segP1.x - segP2.x) < 0.1 && Math.abs(segP1.y - segP2.y) < 0.1) continue;

                for (const rect of rects) {
                    const irx = rect.x - margin;
                    const iry = rect.y - margin;
                    const irw = rect.width + 2 * margin;
                    const irh = rect.height + 2 * margin;
                    const rectRight = irx + irw;
                    const rectBottom = iry + irh;

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
            if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1) {
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

            let usesCentralChannel = false;
            for (let i = 0; i < cleanedPath.length - 1; i++) {
                const p1Seg = cleanedPath[i]; const p2Seg = cleanedPath[i + 1];
                if (Math.abs(p1Seg.y - p2Seg.y) < 0.1) { // Horizontal
                    if (Math.abs(p1Seg.y - centralY) < CENTRAL_CHANNEL_TOLERANCE) { usesCentralChannel = true; break; }
                } else if (Math.abs(p1Seg.x - p2Seg.x) < 0.1) { // Vertical
                    if (Math.abs(p1Seg.x - centralX) < CENTRAL_CHANNEL_TOLERANCE) { usesCentralChannel = true; break; }
                }
            }

            let cost = pathLength + (bends * BEND_PENALTY);
            if (tooCloseToConnection) cost += PROXIMITY_PENALTY;
            if (hardCollisionWithConnection) cost += 100000;
            if (intersectsOtherFibers) cost += FIBER_INTERSECTION_PENALTY;
            if (intersectsOtherCables) cost += CABLE_INTERSECTION_PENALTY;
            if (usesCentralChannel) cost -= CENTRAL_CHANNEL_REWARD;

            candidatePathsStorage.push({
                path: cleanedPath, length: pathLength, bends: bends,
                isClose: tooCloseToConnection, hardCollides: hardCollisionWithConnection, cost: cost
            });
        };

        // ----- Path Generation Strategies -----
        // Strategy 0: Direct line if possible
        if (Math.abs(p1.x - p2.x) < 0.1 || Math.abs(p1.y - p2.y) < 0.1) { addCandidate([p1, p2]); }
        addCandidate([p1, { x: p1.x, y: p2.y }, p2]); // V-H
        addCandidate([p1, { x: p2.x, y: p1.y }, p2]); // H-V

        // Strategy 1: Simple mid-point routing (2 bends)
        const midXOverall = (p1.x + p2.x) / 2; const midYOverall = (p1.y + p2.y) / 2;
        addCandidate([{ x: p1.x, y: p1.y }, { x: midXOverall, y: p1.y }, { x: midXOverall, y: p2.y }, { x: p2.x, y: p2.y }]);
        addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: midYOverall }, { x: p2.x, y: midYOverall }, { x: p2.x, y: p2.y }]);

        // Strategy 2: Using canvas center routing channels with offsets (2 bends)
        const offsets = [0, 25, -25, 50, -50, 75, -75, 100, -100];
        for (const offset of offsets) {
            addCandidate([{ x: p1.x, y: p1.y }, { x: centralX + offset, y: p1.y }, { x: centralX + offset, y: p2.y }, { x: p2.x, y: p2.y }]);
            addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: centralY + offset }, { x: p2.x, y: centralY + offset }, { x: p2.x, y: p2.y }]);
        }

        // Strategy 3: Exit further from cable before turning (2 bends)
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

        // Strategy 4: 3-bend paths using combinations of intermediate channel lines
        const intermediateChannelXs = offsets.map(o => centralX + o); const intermediateChannelYs = offsets.map(o => centralY + o);
        for (const channelX_strat4 of intermediateChannelXs) {
            for (const channelY_strat4 of intermediateChannelYs) {
                addCandidate([p1, { x: channelX_strat4, y: p1.y }, { x: channelX_strat4, y: channelY_strat4 }, { x: p2.x, y: channelY_strat4 }, p2]);
                addCandidate([p1, { x: p1.x, y: channelY_strat4 }, { x: channelX_strat4, y: channelY_strat4 }, { x: channelX_strat4, y: p2.y }, p2]);
            }
        }

        // Strategy 5: Edge routing (routing near canvas edges)
        const edgePadding = 15; const edgeRoutePointsX = [edgePadding, canvasWidth - edgePadding]; const edgeRoutePointsY = [edgePadding, canvasHeight - edgePadding];
        for (const edgeX_strat5 of edgeRoutePointsX) { addCandidate([p1, { x: edgeX_strat5, y: p1.y }, { x: edgeX_strat5, y: p2.y }, p2]); }
        for (const edgeY_strat5 of edgeRoutePointsY) { addCandidate([p1, { x: p1.x, y: edgeY_strat5 }, { x: p2.x, y: edgeY_strat5 }, p2]); }

        // ----- Path Selection -----
        let chosenPath: { x: number; y: number }[];
        if (candidatePathsStorage.length === 0) {
            console.warn("OpticalFiberCanvas: No candidate paths generated, creating direct fallback.");
            chosenPath = [{ ...startFiber.exitPoint }];
            if (startFiber.id !== endFiber.id) { chosenPath.push({ ...endFiber.exitPoint }); }
            else { chosenPath.push({ ...startFiber.exitPoint }); } // Loop to self if IDs are same
        } else {
            candidatePathsStorage.sort((a, b) => a.cost - b.cost);
            const bestPathInfo = candidatePathsStorage[0];
            chosenPath = bestPathInfo.path;
            // console.log(`OpticalFiberCanvas: Chosen path for ${startFiber.id}-${endFiber.id} (cost: ${bestPathInfo.cost.toFixed(0)})`);
        }

        // --- Apply visual offset to path endpoints ---
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
            if (finalPath.length > 0) { // Check again as finalPath could be modified if path had 1 point and it's complex
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
    };

    // Make sure this function is defined within the OpticalFiberCanvas component's scope
    // or passed `managedCables` if it's moved outside.
    // For now, assuming it's inside and has access to `managedCables` from the state.




    // --- Event Handlers ---
    const getMousePos = useCallback((e: React.MouseEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);

        // Check for clicking connection control point or delete icon first
        if (editingConnectionId) {
            const conn = connections.find(c => c.id === editingConnectionId);
            if (conn) {
                // Check delete icon click
                if (conn.deleteIconRect && pos.x >= conn.deleteIconRect.x && pos.x <= conn.deleteIconRect.x + conn.deleteIconRect.width &&
                    pos.y >= conn.deleteIconRect.y && pos.y <= conn.deleteIconRect.y + conn.deleteIconRect.height) {
                    setConnections(prev => prev.filter(c => c.id !== editingConnectionId));
                    setEditingConnectionId(null);
                    return;
                }
                // Check control point drag
                for (let i = 0; i < (conn.controlPoints?.length || 0); i++) {
                    const cp = conn.controlPoints![i];
                    const dist = Math.sqrt((pos.x - cp.x) ** 2 + (pos.y - cp.y) ** 2);
                    if (dist <= CONNECTION_CONTROL_POINT_RADIUS + 2) { // +2 for easier clicking
                        setDraggingControlPoint({
                            connectionId: conn.id,
                            pointIndex: i,
                            offsetX: cp.x - pos.x,
                            offsetY: cp.y - pos.y,
                        });
                        return;
                    }
                }
                if (conn.path.length >= 2) {
                    for (let i = 0; i < conn.path.length - 1; i++) {
                        const p1 = conn.path[i];
                        const p2 = conn.path[i + 1];

                        if (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) <= MIDPOINT_ADD_HANDLE_RADIUS * 4) {
                            continue; // Skip for very short segments
                        }

                        const midX = (p1.x + p2.x) / 2;
                        const midY = (p1.y + p2.y) / 2;
                        const distToMidpoint = Math.sqrt((pos.x - midX) ** 2 + (pos.y - midY) ** 2);

                        if (distToMidpoint <= MIDPOINT_ADD_HANDLE_RADIUS + 2) { // +2 for easier clicking
                            const newPointFromClick = { x: pos.x, y: pos.y }; // New point is initially at mouse position

                            const newPath = [
                                ...conn.path.slice(0, i + 1),      // Includes p1 (original conn.path[i])
                                newPointFromClick,                 // The new vertex, becomes path[i+1]
                                ...conn.path.slice(i + 1)          // Includes p2 (original conn.path[i+1]), now at path[i+2]
                            ];

                            const newPointIndex = i + 1;

                            setConnections(prevConns => prevConns.map(c => {
                                if (c.id === conn.id) {
                                    return {
                                        ...c,
                                        path: newPath, // Path with the newly inserted point
                                        // Control points are regenerated based on the new path in the mouseMove
                                        controlPoints: newPath.map(p_ => ({ ...p_, radius: CONNECTION_CONTROL_POINT_RADIUS }))
                                    };
                                }
                                return c;
                            }));

                            // Immediately start dragging this newly added point.
                            // offsetX and offsetY are 0 because newPointFromClick IS pos.
                            setDraggingControlPoint({
                                connectionId: conn.id,
                                pointIndex: newPointIndex,
                                offsetX: newPointFromClick.x - pos.x, // This will be 0
                                offsetY: newPointFromClick.y - pos.y, // This will be 0
                            });
                            setActivePresplice(null);
                            setSelectedFiberId1(null);
                            return;
                        }
                    }
                }

            }
        }


        // Check for cable drag handle click
        for (const cable of managedCables) {
            const dist = Math.sqrt((pos.x - cable.dragHandle.x) ** 2 + (pos.y - cable.dragHandle.y) ** 2);
            if (dist <= cable.dragHandle.radius) {
                setDraggingCableInfo({
                    cableId: cable.id,
                    offsetX: cable.x - pos.x,
                    offsetY: cable.y - pos.y,
                });
                setManagedCables(prev => prev.map(c => c.id === cable.id ? { ...c, dragHandle: { ...c.dragHandle, isActive: true } } : c));
                return;
            }
        }

        // Check for presplice '+' icon click
        if (activePresplice) {
            const { x, y, size } = activePresplice.plusIconPosition;
            if (pos.x >= x - size / 2 && pos.x <= x + size / 2 &&
                pos.y >= y - size / 2 && pos.y <= y + size / 2) {

                const fiber1 = getFiberById(activePresplice.fiber1Id);
                const fiber2 = getFiberById(activePresplice.fiber2Id);
                const cable1 = getCableByFiberId(activePresplice.fiber1Id);
                const cable2 = getCableByFiberId(activePresplice.fiber2Id);
                console.log(fiber1, fiber2, cable1, cable2, managedCables);

                if (fiber1 && fiber2 && cable1 && cable2) {
                    const newPath = generateManhattanPathWithAvoidance(fiber1, fiber2, cable1, cable2, connections, width, height);
                    const newConnection: Connection = {
                        id: `conn-${Date.now()}`,
                        fiber1Id: fiber1.id,
                        fiber2Id: fiber2.id,
                        path: newPath,
                        color1: fiber1.originalColor,
                        color2: fiber2.originalColor,
                        isMarked1: fiber1.isMarked,
                        isMarked2: fiber2.isMarked,
                    };
                    setConnections(prev => [...prev, newConnection]);
                    setActivePresplice(null);
                    setSelectedFiberId1(null);
                    setEditingConnectionId(null); // Clear any other editing state
                    return;
                }
            }
        }

        // Check for fiber click
        const connectedFiberIds = new Set(connections.flatMap(c => [c.fiber1Id, c.fiber2Id]));
        for (const cable of managedCables) {
            for (const fiber of cable.fibers) {
                if (connectedFiberIds.has(fiber.id)) continue; // Already connected

                if (pos.x >= fiber.rect.x && pos.x <= fiber.rect.x + fiber.rect.width &&
                    pos.y >= fiber.rect.y && pos.y <= fiber.rect.y + fiber.rect.height) {

                    if (!selectedFiberId1) {
                        setSelectedFiberId1(fiber.id);
                        setActivePresplice(null); // Clear any existing presplice
                        setEditingConnectionId(null);
                    } else if (selectedFiberId1 !== fiber.id) {
                        const firstFiber = getFiberById(selectedFiberId1);
                        if (firstFiber) {
                            setActivePresplice({
                                fiber1Id: selectedFiberId1,
                                fiber2Id: fiber.id,
                                lineStart: firstFiber.exitPoint,
                                lineEnd: fiber.exitPoint,
                                plusIconPosition: {
                                    x: (firstFiber.exitPoint.x + fiber.exitPoint.x) / 2,
                                    y: (firstFiber.exitPoint.y + fiber.exitPoint.y) / 2,
                                    size: PRESPLICE_PLUS_SIZE,
                                }
                            });
                            // setSelectedFiberId1(null); // Reset after forming presplice
                        }
                    }
                    return;
                }
            }
        }

        // Check for clicking on a connection line to enable editing
        for (const conn of connections) {
            // Check if click is near any segment of the path
            for (let i = 0; i < conn.path.length - 1; i++) {
                const p1 = conn.path[i];
                const p2 = conn.path[i + 1];
                // Simple point-to-line segment distance check (approximate)
                const distToLine = Math.abs((p2.y - p1.y) * pos.x - (p2.x - p1.x) * pos.y + p2.x * p1.y - p2.y * p1.x) /
                    Math.sqrt((p2.y - p1.y) ** 2 + (p2.x - p1.x) ** 2);
                const withinBounds =
                    (Math.min(p1.x, p2.x) - 5 <= pos.x && pos.x <= Math.max(p1.x, p2.x) + 5) &&
                    (Math.min(p1.y, p2.y) - 5 <= pos.y && pos.y <= Math.max(p1.y, p2.y) + 5);

                if (distToLine < 5 && withinBounds) { // Clicked near the line segment
                    setEditingConnectionId(conn.id);
                    // Populate control points for editing if not already there
                    // For Manhattan, control points are essentially the path vertices
                    setConnections(prevConns => prevConns.map(c => {
                        if (c.id === conn.id) {
                            return {
                                ...c,
                                controlPoints: c.path.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS })),
                                deleteIconRect: { // Position delete icon, e.g., near the middle of the path
                                    x: c.path[Math.floor(c.path.length / 2)].x - DELETE_ICON_SIZE / 2,
                                    y: c.path[Math.floor(c.path.length / 2)].y - DELETE_ICON_SIZE / 2,
                                    width: DELETE_ICON_SIZE,
                                    height: DELETE_ICON_SIZE,
                                }
                            };
                        }
                        return c;
                    }));
                    setSelectedFiberId1(null);
                    setActivePresplice(null);
                    return;
                }
            }
        }

        // If clicked on empty space, deselect
        setSelectedFiberId1(null);
        setActivePresplice(null);
        setEditingConnectionId(null);

    }, [managedCables, activePresplice, selectedFiberId1, connections, editingConnectionId, getFiberById, getCableByFiberId, generateManhattanPathWithAvoidance]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);

        if (draggingCableInfo) {
            // --- CABLE DRAGGING LOGIC (Keep AS IS) ---
            setManagedCables(prevCables => {
                // ... (Full existing logic for updating cable position, orientation, and layout)
                // ... (This part calls calculateLayout)
                let newCables = prevCables.map(c => {
                    if (c.id === draggingCableInfo.cableId) {
                        let newX = pos.x + draggingCableInfo.offsetX;
                        let newY = pos.y + draggingCableInfo.offsetY;
                        let newOrientation = c.orientation;
                        const cableHeightCurrent = c.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;
                        const cableWidthCurrent = c.fibers.length * (FIBER_DIMENSION_PARALLEL + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;

                        if (c.orientation === 'vertical') {
                            if (newY < -EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'horizontal'; newY = CANVAS_PADDING / 2; newX = Math.max(0, Math.min(width - cableWidthCurrent, newX));
                            } else if (newY + cableHeightCurrent > height + EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'horizontal'; newY = height - CABLE_THICKNESS - CANVAS_PADDING / 2; newX = Math.max(0, Math.min(width - cableWidthCurrent, newX));
                            }
                        } else {
                            if (newX < -EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'vertical'; newX = CANVAS_PADDING / 2; newY = Math.max(0, Math.min(height - cableHeightCurrent, newY));
                            } else if (newX + cableWidthCurrent > width + EDGE_TRANSFORM_THRESHOLD) {
                                newOrientation = 'vertical'; newX = width - CABLE_THICKNESS - CANVAS_PADDING / 2; newY = Math.max(0, Math.min(height - cableHeightCurrent, newY));
                            }
                        }
                        const draggedCableRect = { x: newX, y: newY, width: c.rect.width, height: c.rect.height };
                        const isOverlapping = prevCables.some(otherCable => {
                            if (otherCable.id !== c.id && !otherCable.isDragging) {
                                const otherRect = otherCable.rect;
                                return (
                                    draggedCableRect.x < otherRect.x + otherRect.width &&
                                    draggedCableRect.x + draggedCableRect.width > otherRect.x &&
                                    draggedCableRect.y < otherRect.y + otherRect.height &&
                                    draggedCableRect.y + draggedCableRect.height > otherRect.y
                                );
                            } return false;
                        });
                        if (!isOverlapping) return { ...c, x: newX, y: newY, orientation: newOrientation, isDragging: true };
                        else return { ...c, isDragging: true };
                    }
                    return { ...c, isDragging: false };
                });
                return calculateLayout(newCables.map(nc => ({ ...nc, isDragging: draggingCableInfo?.cableId === nc.id })));
            });
            setConnections(prevConns => { // Paths are regenerated as Manhattan here
                return prevConns.map(conn => {
                    const fiber1 = getFiberById(conn.fiber1Id);
                    const fiber2 = getFiberById(conn.fiber2Id);
                    const cable1 = getCableByFiberId(conn.fiber1Id);
                    const cable2 = getCableByFiberId(conn.fiber2Id);
                    if (fiber1 && fiber2 && cable1 && cable2) {
                        // Regenerate path - this will be Manhattan, user's diagonal edits will be lost
                        const newPath = generateManhattanPathWithAvoidance(fiber1, fiber2, cable1, cable2, prevConns.filter(cn => cn.id !== conn.id), width, height, conn.id);
                        let updatedConn = { ...conn, path: newPath };
                        if (editingConnectionId === conn.id) { // If it was being edited, update its CPs too
                            updatedConn.controlPoints = newPath.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS }));
                            updatedConn.deleteIconRect = {
                                x: newPath.length > 0 ? newPath.reduce((sumX, p) => sumX + p.x, 0) / newPath.length - DELETE_ICON_SIZE / 2 : 0,
                                y: newPath.length > 0 ? newPath.reduce((sumY, p) => sumY + p.y, 0) / newPath.length - DELETE_ICON_SIZE / 2 : 0,
                                width: DELETE_ICON_SIZE, height: DELETE_ICON_SIZE,
                            };
                        }
                        return updatedConn;
                    }
                    return conn;
                });
            });
        } else if (draggingControlPoint) {
            // --- CONTROL POINT DRAGGING LOGIC ---
            setConnections(prevConns => prevConns.map(conn => {
                if (conn.id === draggingControlPoint.connectionId) {
                    const currentPath = [...conn.path]; 
                    const pointIndex = draggingControlPoint.pointIndex;

                    if (pointIndex < 0 || pointIndex >= currentPath.length) return conn; // Safety

                    let newPointX = pos.x + draggingControlPoint.offsetX;
                    let newPointY = pos.y + draggingControlPoint.offsetY;

                    // Optional: Clamp to canvas bounds
                    newPointX = Math.max(0, Math.min(width, newPointX));
                    newPointY = Math.max(0, Math.min(height, newPointY));
                    
                    const draggedPoint = { x: newPointX, y: newPointY };
                    currentPath[pointIndex] = draggedPoint; // Directly update the dragged point's position

                    // --- MANHATTAN ENFORCEMENT ON NEIGHBORS IS NOW REMOVED ---
                    // The old logic that adjusted currentPath[pointIndex-1] and 
                    // currentPath[pointIndex+1] to be strictly H/V with draggedPoint is omitted.

                    // --- ANCHOR ENDPOINTS (if not being dragged) ---
                    // The ultimate start and end of the connection path should still attach
                    // to the (offsetted) fiber exit points, unless those specific points are being dragged.
                    const fiber1 = getFiberById(conn.fiber1Id);
                    const fiber2 = getFiberById(conn.fiber2Id);

                    if (pointIndex !== 0 && fiber1) { // If NOT dragging the start point, re-anchor it
                        let f1Exit = { ...fiber1.exitPoint };
                        const startCable = getCableByFiberId(conn.fiber1Id);
                        if (startCable) {
                            if (startCable.orientation === 'vertical') {
                                f1Exit.x += (startCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                            } else {
                                f1Exit.y += (startCable.y < height / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                            }
                        }
                        currentPath[0] = f1Exit;
                    }
                    if (pointIndex !== currentPath.length - 1 && fiber2) { // If NOT dragging the end point, re-anchor it
                        let f2Exit = { ...fiber2.exitPoint };
                        const endCable = getCableByFiberId(conn.fiber2Id);
                        if (endCable) {
                            if (endCable.orientation === 'vertical') {
                                f2Exit.x += (endCable.originalType === 'in' ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                            } else {
                                f2Exit.y += (endCable.y < height / 2 ? CONNECTION_VISUAL_OFFSET : -CONNECTION_VISUAL_OFFSET);
                            }
                        }
                        currentPath[currentPath.length - 1] = f2Exit;
                    }
                    
                    // Basic path simplification: remove consecutive duplicate points
                    const simplifiedPath = currentPath.reduce((acc, p, idx) => {
                        if (idx === 0 || Math.abs(p.x - acc[acc.length - 1].x) > 0.01 || Math.abs(p.y - acc[acc.length - 1].y) > 0.01) {
                            acc.push(p);
                        } else if (idx === currentPath.length -1 ) { // Ensure last point is kept if different from previous even if new prev is same
                             acc.push(p);
                        }
                        return acc;
                    }, [] as {x: number, y: number}[]);

                    // Ensure the path has at least one point, or two if it's not a self-loop
                    let finalPathForConnection = simplifiedPath;
                    if (finalPathForConnection.length === 0 && currentPath.length > 0) {
                        finalPathForConnection = [currentPath[0]]; // At least one point
                    }
                    if (finalPathForConnection.length === 1 && fiber1 && fiber2 && fiber1.id !== fiber2.id && currentPath.length > 1) {
                         // If it collapsed to one point but wasn't a self-loop, restore original endpoints for safety
                         // This scenario means the dragged point made the path invalid, likely by coinciding with both neighbors.
                         // A better recovery might be just the two (offsetted) fiber exit points.
                        const safePath = [currentPath[0]];
                        if(currentPath.length > 1) safePath.push(currentPath[currentPath.length-1]);

                        const uniqueSafePath = safePath.reduce((acc, p, idx) => {
                             if (idx === 0 || Math.abs(p.x - acc[acc.length - 1].x) > 0.01 || Math.abs(p.y - acc[acc.length - 1].y) > 0.01) {
                                acc.push(p);
                            }
                            return acc;
                        }, [] as {x: number, y: number}[]);
                        finalPathForConnection = uniqueSafePath.length > 0 ? uniqueSafePath : [draggedPoint];
                    }


                    return { 
                        ...conn, 
                        path: finalPathForConnection, 
                        controlPoints: finalPathForConnection.map(p_ => ({ ...p_, radius: CONNECTION_CONTROL_POINT_RADIUS })) 
                    };
                }
                return conn;
            }));
        }
    }, [draggingCableInfo, draggingControlPoint, width, height, calculateLayout, getFiberById, getCableByFiberId, connections, getMousePos, editingConnectionId /* Added editingConnectionId */]);
    const handleMouseUp = useCallback(() => {
        if (draggingCableInfo) {
            setManagedCables(prev => prev.map(c => c.id === draggingCableInfo.cableId ? { ...c, dragHandle: { ...c.dragHandle, isActive: false } } : c));
        }
        setDraggingCableInfo(null);
        setDraggingControlPoint(null);
    }, [draggingCableInfo]);

    // Re-calculate connections if cables move
    useEffect(() => {
        // if (activePresplice) {
        //     const fiber1 = getFiberById(activePresplice.fiber1Id);
        //     const fiber2 = getFiberById(activePresplice.fiber2Id);
        //      if (fiber1 && fiber2) {
        //         setActivePresplice(ap => ap ? ({
        //             ...ap,
        //             lineStart: fiber1.exitPoint,
        //             lineEnd: fiber2.exitPoint,
        //             plusIconPosition: {
        //                 x: (fiber1.exitPoint.x + fiber2.exitPoint.x) / 2,
        //                 y: (fiber1.exitPoint.y + fiber2.exitPoint.y) / 2,
        //                 size: PRESPLICE_PLUS_SIZE,
        //             }
        //         }) : null);
        //     }
        // }

    }, [managedCables, getFiberById, getCableByFiberId, generateManhattanPathWithAvoidance, editingConnectionId, activePresplice]);


    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // Stop dragging if mouse leaves canvas
            style={{ border: '1px solid #ccc', background: '#f0f0f0' }}
        />
    );
};

export default OpticalFiberCanvas;