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
const LINE_THICKNESS_FOR_COLLISION = 16; 
// Add these near your other constants
const BEND_PENALTY = 30; // Arbitrary cost equivalent to 30px of length for each bend
const PROXIMITY_PENALTY = 60; // Arbitrary cost if a path is too close to another
const PROXIMITY_MARGIN = LINE_THICKNESS_FOR_COLLISION + 6; // How close is "too close". Must be > LINE_THICKNESS_FOR_COLLISION

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
                dhy = (cable.y < height/2) ? cableY + DRAG_HANDLE_OFFSET : cableY + cableHeight - DRAG_HANDLE_OFFSET ;
            }


            return { ...cable, fibers: updatedFibers, rect: {x: cableX, y: cableY, width: cableWidth, height: cableHeight}, dragHandle: {x: dhx, y: dhy, radius: DRAG_HANDLE_RADIUS} };
        });
    }, [width, height]);

    useEffect(() => {
        const initialProcessedCables: Cable[] = initialCables.map((c, index) => {
            const cableId = `${index}-${c.type}`;
            const orientation: 'vertical' | 'horizontal' = 'vertical';
            let initialX = 0;
            const numFibers = c.fibers.length;
            const cableVisualHeight = numFibers * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;


            if (c.type === 'in') {
                initialX = CANVAS_PADDING;
            } else {
                initialX = width - CABLE_THICKNESS - CANVAS_PADDING;
            }
            // Distribute cables vertically initially
            const initialY = CANVAS_PADDING + index * (cableVisualHeight + 20);


            return {
                id: cableId,
                originalType: c.type,
                fibers: c.fibers.map((f, fIndex) => ({
                    id: `${cableId}-${fIndex}`,
                    originalColor: f.color,
                    isMarked: f.isMarked,
                    rect: { x: 0, y: 0, width: 0, height: 0 }, // To be calculated
                    exitPoint: { x: 0, y: 0 }, // To be calculated
                    cableId: cableId,
                })),
                x: initialX,
                y: initialY,
                orientation: orientation,
                rect: {x:0,y:0,width:0,height:0},
                dragHandle: {x:0,y:0, radius: DRAG_HANDLE_RADIUS},
            };
        });
        setManagedCables(calculateLayout(initialProcessedCables));
    }, [initialCables, width, height, calculateLayout]);


    // --- Drawing Functions ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        
        // Draw Presplice
        if (activePresplice) {
            ctx.beginPath();
            ctx.moveTo(activePresplice.lineStart.x, activePresplice.lineStart.y);
            ctx.lineTo(activePresplice.lineEnd.x, activePresplice.lineEnd.y);
            ctx.strokeStyle = 'grey';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw '+' icon
            const { x, y, size } = activePresplice.plusIconPosition;
            ctx.fillStyle = 'green';
            ctx.fillRect(x - size / 2, y - size / 6, size, size / 3);
            ctx.fillRect(x - size / 6, y - size / 2, size / 3, size);
        }


        // Draw Cables and Fibers
        managedCables.forEach(cable => {
            // Draw cable body
            ctx.fillStyle = 'black';
            ctx.fillRect(cable.rect.x, cable.rect.y, cable.rect.width, cable.rect.height);

            // Draw fibers
            cable.fibers.forEach(fiber => {
                ctx.fillStyle = fiber.originalColor;
                ctx.fillRect(fiber.rect.x, fiber.rect.y, fiber.rect.width, fiber.rect.height);
                
                if (selectedFiberId1 === fiber.id && !activePresplice) {
                     ctx.strokeStyle = 'yellow'; // Highlight for first selected fiber
                     ctx.lineWidth = 2;
                     ctx.strokeRect(fiber.rect.x, fiber.rect.y, fiber.rect.width, fiber.rect.height);
                }

                if (fiber.isMarked) {
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 1;
                    const numMarks = 3;
                    for (let i = 1; i <= numMarks; i++) {
                        if (cable.orientation === 'vertical') { // Horizontal marks on fiber
                            const markY = fiber.rect.y + (fiber.rect.height * i / (numMarks + 1));
                            ctx.beginPath();
                            ctx.moveTo(fiber.rect.x, markY);
                            ctx.lineTo(fiber.rect.x + fiber.rect.width, markY);
                            ctx.stroke();
                        } else { // Vertical marks on fiber (if fiber itself is oriented vertically)
                            const markX = fiber.rect.x + (fiber.rect.width * i / (numMarks + 1));
                            ctx.beginPath();
                            ctx.moveTo(markX, fiber.rect.y);
                            ctx.lineTo(markX, fiber.rect.y + fiber.rect.height);
                            ctx.stroke();
                        }
                    }
                }
            });

            // Draw drag handle
            ctx.beginPath();
            ctx.arc(cable.dragHandle.x, cable.dragHandle.y, cable.dragHandle.radius, 0, 2 * Math.PI);
            ctx.fillStyle = cable.dragHandle.isActive ? 'lime' : 'green';
            ctx.fill();
        });

        // Draw Connections
        connections.forEach(conn => {
            const fiber1 = getFiberById(conn.fiber1Id);
            const fiber2 = getFiberById(conn.fiber2Id);
            if (!fiber1 || !fiber2) return;

            ctx.beginPath();
            ctx.moveTo(conn.path[0].x, conn.path[0].y);
            for (let i = 1; i < conn.path.length; i++) {
                ctx.lineTo(conn.path[i].x, conn.path[i].y);
            }
            // Simple two-color split at midpoint of path segments
            // A more accurate split would involve calculating total path length
            const midPointIndex = Math.floor(conn.path.length / 2);
            
            // Draw first half
            ctx.strokeStyle = conn.color1;
            ctx.lineWidth = CONNECTION_LINE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(conn.path[0].x, conn.path[0].y);
            for (let i = 1; i <= midPointIndex; i++) {
                 ctx.lineTo(conn.path[i].x, conn.path[i].y);
            }
            ctx.stroke();
             if (conn.isMarked1) {
                drawMarksOnPath(ctx, conn.path.slice(0, midPointIndex + 1), conn.color1);
            }


            // Draw second half
            ctx.strokeStyle = conn.color2;
            ctx.lineWidth = CONNECTION_LINE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(conn.path[midPointIndex].x, conn.path[midPointIndex].y);
            for (let i = midPointIndex + 1; i < conn.path.length; i++) {
                 ctx.lineTo(conn.path[i].x, conn.path[i].y);
            }
            ctx.stroke();
            if (conn.isMarked2) {
                 drawMarksOnPath(ctx, conn.path.slice(midPointIndex), conn.color2);
            }


            if (editingConnectionId === conn.id) {
                // Draw control points
                conn.controlPoints?.forEach(cp => {
                    ctx.beginPath();
                    ctx.arc(cp.x, cp.y, CONNECTION_CONTROL_POINT_RADIUS, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(0,0,255,0.7)';
                    ctx.fill();
                });
                // Draw delete icon
                if (conn.deleteIconRect) {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(conn.deleteIconRect.x, conn.deleteIconRect.y, conn.deleteIconRect.width, conn.deleteIconRect.height);
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

    }, [managedCables, connections, activePresplice, selectedFiberId1, editingConnectionId, width, height, getFiberById]);

    const drawMarksOnPath = (ctx: CanvasRenderingContext2D, path: {x:number, y:number}[], color: string) => {
        ctx.strokeStyle = 'black'; // Marks are black
        ctx.lineWidth = 1;
        const markLength = 4; // Length of the small mark lines
        const markSpacing = 8; // Spacing along the path segment for marks

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx*dx + dy*dy);
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

    const addCandidate = (rawPath: { x: number, y: number }[]) => {
        // Using the more robust cleaning logic from your previous full component example
        const cleanedPath = rawPath.reduce((acc, point, index) => {
            if (index === 0 || Math.abs(point.x - acc[acc.length - 1].x) > 0.01 || Math.abs(point.y - acc[acc.length - 1].y) > 0.01) {
                acc.push(point);
            } else if (index === rawPath.length - 1 && rawPath.length > 1 && (Math.abs(point.x - acc[acc.length - 1].x) < 0.01 && Math.abs(point.y - acc[acc.length - 1].y) < 0.01)) {
                if (acc.length > 0) acc[acc.length - 1] = point; else acc.push(point);
            }
            return acc;
        }, [] as { x: number, y: number }[]);
        
        if (cleanedPath.length < 2 && (Math.abs(p1.x - p2.x) > 0.1 || Math.abs(p1.y - p2.y) > 0.1)) {
             if(cleanedPath.length === 1 && Math.abs(cleanedPath[0].x - p1.x) < 0.1 && Math.abs(cleanedPath[0].y - p1.y) < 0.1) {
                cleanedPath.push({...p2}); // Try to make it valid by adding endpoint
            } else {
                return; 
            }
        }
        if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1) { // If start and end are same
            if (cleanedPath.length === 0) cleanedPath.push({...p1}, {...p2});
            else if (cleanedPath.length === 1 && Math.abs(cleanedPath[0].x - p1.x) < 0.1 && Math.abs(cleanedPath[0].y - p1.y) < 0.1) cleanedPath.push({...p2});
        }
         if (cleanedPath.length < 2) return; // Final check


        let pathLength = 0;
        for (let i = 0; i < cleanedPath.length - 1; i++) {
            pathLength += Math.abs(cleanedPath[i].x - cleanedPath[i + 1].x) + Math.abs(cleanedPath[i].y - cleanedPath[i + 1].y);
        }

        let bends = 0;
        for (let i = 1; i < cleanedPath.length - 1; i++) {
            const pPrev = cleanedPath[i - 1];
            const pCurr = cleanedPath[i];
            const pNext = cleanedPath[i + 1];
            const dx1 = pCurr.x - pPrev.x;
            const dy1 = pCurr.y - pPrev.y;
            const dx2 = pNext.x - pCurr.x;
            const dy2 = pNext.y - pCurr.y;
            if ((Math.abs(dx1) > 0.01 && Math.abs(dy2) > 0.01) || (Math.abs(dy1) > 0.01 && Math.abs(dx2) > 0.01)) {
                bends++;
            }
        }

        const hardCollision = pathCollides(cleanedPath, existingConnections, connectionIdToUpdate);
        // Only check for "too close" if there isn't a hard collision, as hard collision is worse.
        const tooClose = !hardCollision ? pathIsTooClose(cleanedPath, existingConnections, PROXIMITY_MARGIN, connectionIdToUpdate) : false;

        let cost = pathLength + (bends * BEND_PENALTY);
        if (tooClose) {
            cost += PROXIMITY_PENALTY;
        }
        if (hardCollision) {
            cost += 100000; // Very large penalty for hard collision
        }

        candidatePathsStorage.push({
            path: cleanedPath,
            length: pathLength,
            bends: bends,
            isClose: tooClose,
            hardCollides: hardCollision,
            cost: cost
        });
    };

    // ----- Path Generation Strategies -----

    // Strategy 0: Direct line if possible (already somewhat handled by cleaning, but explicit check can be good)
    if (Math.abs(p1.x - p2.x) < 0.1 || Math.abs(p1.y - p2.y) < 0.1) { // Aligned
         addCandidate([p1, p2]);
    }
    addCandidate([p1, {x: p1.x, y:p2.y}, p2]); // V-H
    addCandidate([p1, {x: p2.x, y:p1.y}, p2]); // H-V


    // Strategy 1: Simple mid-point routing (2 bends)
    const midXOverall = (p1.x + p2.x) / 2;
    const midYOverall = (p1.y + p2.y) / 2;
    addCandidate([{ x: p1.x, y: p1.y }, { x: midXOverall, y: p1.y }, { x: midXOverall, y: p2.y }, { x: p2.x, y: p2.y }]); // H-V-H
    addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: midYOverall }, { x: p2.x, y: midYOverall }, { x: p2.x, y: p2.y }]); // V-H-V

    // Strategy 2: Using canvas center routing channels with offsets (2 bends)
    const centralX = canvasWidth / 2;
    const centralY = canvasHeight / 2;
    const offsets = [0, 25, -25, 50, -50, 75, -75, 100, -100]; // Expanded offsets

    for (const offset of offsets) {
        addCandidate([{ x: p1.x, y: p1.y }, { x: centralX + offset, y: p1.y }, { x: centralX + offset, y: p2.y }, { x: p2.x, y: p2.y }]);
        addCandidate([{ x: p1.x, y: p1.y }, { x: p1.x, y: centralY + offset }, { x: p2.x, y: centralY + offset }, { x: p2.x, y: p2.y }]);
    }

    // Strategy 3: Exit further from cable before turning (2 bends)
    const exitDistances = [CABLE_THICKNESS + 10, CABLE_THICKNESS + 30, CABLE_THICKNESS + 50];
    for (const exitDistance of exitDistances) {
        let exitP1X = p1.x, exitP1Y = p1.y;
        let tempPath: {x:number, y:number}[];

        if (startCable.orientation === 'vertical') {
            exitP1X = p1.x + (startCable.originalType === 'in' ? exitDistance : -exitDistance);
            tempPath = [{x: p1.x, y: p1.y}, {x: exitP1X, y: p1.y}, {x: exitP1X, y: p2.y}, {x: p2.x, y: p2.y}]; // H-V-H
            addCandidate(tempPath);
        } else { // Horizontal start cable
            exitP1Y = p1.y + (startCable.y < canvasHeight / 2 ? exitDistance : -exitDistance);
            tempPath = [{x: p1.x, y: p1.y}, {x: p1.x, y: exitP1Y}, {x: p2.x, y: exitP1Y}, {x: p2.x, y: p2.y}]; // V-H-V
            addCandidate(tempPath);
        }
    }
    
    // Strategy 4: 3-bend paths using combinations of intermediate channel lines
    // These create paths like H-V-H-V or V-H-V-H
    const intermediateChannelXs = offsets.map(o => centralX + o);
    const intermediateChannelYs = offsets.map(o => centralY + o);

    for (const channelX of intermediateChannelXs) {
        for (const channelY of intermediateChannelYs) {
            // H-V-H-V attempt 1: p1 -> (chX, p1.y) -> (chX, chY) -> (p2.x, chY) -> p2
            addCandidate([p1, { x: channelX, y: p1.y }, { x: channelX, y: channelY }, { x: p2.x, y: channelY }, p2]);
            // V-H-V-H attempt 1: p1 -> (p1.x, chY) -> (chX, chY) -> (chX, p2.y) -> p2
            addCandidate([p1, { x: p1.x, y: channelY }, { x: channelX, y: channelY }, { x: channelX, y: p2.y }, p2]);
        }
    }
    
    // Strategy 5: Edge routing (routing near canvas edges)
    const edgePadding = 15; // How far from the canvas edge
    const edgeRoutePointsX = [edgePadding, canvasWidth - edgePadding];
    const edgeRoutePointsY = [edgePadding, canvasHeight - edgePadding];

    for (const edgeX of edgeRoutePointsX) {
        addCandidate([p1, { x: edgeX, y: p1.y }, { x: edgeX, y: p2.y }, p2]); // H-V-H via edge X
    }
    for (const edgeY of edgeRoutePointsY) {
         addCandidate([p1, { x: p1.x, y: edgeY }, { x: p2.x, y: edgeY }, p2]); // V-H-V via edge Y
    }


    // ----- Path Selection -----
    if (candidatePathsStorage.length === 0) {
        console.warn("OpticalFiberCanvas: No candidate paths generated at all, using direct line as absolute fallback.");
        return [p1, p2]; // Should be extremely rare if basic strategies exist
    }

    candidatePathsStorage.sort((a, b) => a.cost - b.cost);

    const bestPathInfo = candidatePathsStorage[0];

    // Optional: Log why a certain path was chosen, or if it's suboptimal
    // if (bestPathInfo.hardCollides) {
    //     console.warn(`OpticalFiberCanvas: Best path for new connection still has hard collision (cost: ${bestPathInfo.cost}).`);
    // } else if (bestPathInfo.isClose) {
    //     console.log(`OpticalFiberCanvas: Best path is close to another (cost: ${bestPathInfo.cost}).`);
    // } else {
    //     console.log(`OpticalFiberCanvas: Found clear path (cost: ${bestPathInfo.cost}).`);
    // }

    return bestPathInfo.path;
};



    // --- Event Handlers ---
    const getMousePos = useCallback((e: React.MouseEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },[]);

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
                    const dist = Math.sqrt((pos.x - cp.x)**2 + (pos.y - cp.y)**2);
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
            }
        }


        // Check for cable drag handle click
        for (const cable of managedCables) {
            const dist = Math.sqrt((pos.x - cable.dragHandle.x)**2 + (pos.y - cable.dragHandle.y)**2);
            if (dist <= cable.dragHandle.radius) {
                setDraggingCableInfo({
                    cableId: cable.id,
                    offsetX: cable.x - pos.x,
                    offsetY: cable.y - pos.y,
                });
                 setManagedCables(prev => prev.map(c => c.id === cable.id ? {...c, dragHandle: {...c.dragHandle, isActive: true}} : c));
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
                const p2 = conn.path[i+1];
                // Simple point-to-line segment distance check (approximate)
                const distToLine = Math.abs((p2.y - p1.y) * pos.x - (p2.x - p1.x) * pos.y + p2.x * p1.y - p2.y * p1.x) /
                                   Math.sqrt((p2.y - p1.y)**2 + (p2.x - p1.x)**2);
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
            setManagedCables(prevCables => {
                let newCables = prevCables.map(c => {
                    if (c.id === draggingCableInfo.cableId) {
                        let newX = pos.x + draggingCableInfo.offsetX;
                        let newY = pos.y + draggingCableInfo.offsetY;
                        let newOrientation = c.orientation;
                        
                        // Edge transformation logic
                        const cableHeightCurrent = c.fibers.length * (FIBER_DIMENSION_PERPENDICULAR + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;
                        const cableWidthCurrent = c.fibers.length * (FIBER_DIMENSION_PARALLEL + FIBER_SPACING) - FIBER_SPACING + 2 * FIBER_SPACING;


                        if (c.orientation === 'vertical') {
                            if (newY < -EDGE_TRANSFORM_THRESHOLD) { // Transform to top
                                newOrientation = 'horizontal';
                                newY = CANVAS_PADDING / 2;
                                newX = Math.max(0, Math.min(width - cableWidthCurrent, newX));
                            } else if (newY + cableHeightCurrent > height + EDGE_TRANSFORM_THRESHOLD) { // Transform to bottom
                                newOrientation = 'horizontal';
                                newY = height - CABLE_THICKNESS - CANVAS_PADDING / 2;
                                 newX = Math.max(0, Math.min(width - cableWidthCurrent, newX));
                            }
                        } else { // Horizontal
                             if (newX < -EDGE_TRANSFORM_THRESHOLD) { // Transform to left
                                newOrientation = 'vertical';
                                newX = CANVAS_PADDING / 2;
                                newY = Math.max(0, Math.min(height - cableHeightCurrent, newY));
                            } else if (newX + cableWidthCurrent > width + EDGE_TRANSFORM_THRESHOLD) { // Transform to right
                                newOrientation = 'vertical';
                                newX = width - CABLE_THICKNESS - CANVAS_PADDING / 2;
                                newY = Math.max(0, Math.min(height - cableHeightCurrent, newY));
                            }
                        }
                        return { ...c, x: newX, y: newY, orientation: newOrientation };
                    }
                    return c;
                });
                return calculateLayout(newCables);
            });
            setConnections(prevConns => {
            return prevConns.map(conn => {
                const fiber1 = getFiberById(conn.fiber1Id);
                const fiber2 = getFiberById(conn.fiber2Id);
                const cable1 = getCableByFiberId(conn.fiber1Id);
                const cable2 = getCableByFiberId(conn.fiber2Id);
                if (fiber1 && fiber2 && cable1 && cable2) {
                    const newPath = generateManhattanPathWithAvoidance(fiber1, fiber2, cable1, cable2, connections, width, height);
                     let updatedConn = { ...conn, path: newPath };
                     if (editingConnectionId === conn.id) {
                        updatedConn.controlPoints = newPath.map(p => ({ ...p, radius: CONNECTION_CONTROL_POINT_RADIUS }));
                        updatedConn.deleteIconRect = {
                            x: newPath[Math.floor(newPath.length / 2)].x - DELETE_ICON_SIZE / 2,
                            y: newPath[Math.floor(newPath.length / 2)].y - DELETE_ICON_SIZE / 2,
                            width: DELETE_ICON_SIZE,
                            height: DELETE_ICON_SIZE,
                        };
                     }
                     return updatedConn;
                }
                return conn; // Should ideally remove if fibers/cables are gone, but for now just update
            });
        });
        } else if (draggingControlPoint) {
            setConnections(prevConns => prevConns.map(conn => {
                if (conn.id === draggingControlPoint.connectionId) {
                    const newPath = [...conn.path];
                    const pointIndex = draggingControlPoint.pointIndex;
                    
                    // For Manhattan lines, moving one point might require adjusting neighbors
                    // This is a simplified drag: only updates the selected point.
                    // More complex logic would ensure lines remain strictly horizontal/vertical.
                    const oldPoint = newPath[pointIndex];
                    const newPointX = pos.x + draggingControlPoint.offsetX;
                    const newPointY = pos.y + draggingControlPoint.offsetY;

                    newPath[pointIndex] = {x: newPointX, y: newPointY};
                    
                    // Adjust adjacent points to maintain Manhattan nature (basic)
                    if (pointIndex > 0) { // Adjust previous point's coordinate based on segment type
                        const prevPoint = newPath[pointIndex - 1];
                        if (Math.abs(oldPoint.x - prevPoint.x) > Math.abs(oldPoint.y - prevPoint.y)) { // Was horizontal segment
                            newPath[pointIndex-1] = {...prevPoint, y: newPointY};
                        } else { // Was vertical segment
                             newPath[pointIndex-1] = {...prevPoint, x: newPointX};
                        }
                    }
                    if (pointIndex < newPath.length - 1) { // Adjust next point's coordinate
                        const nextPoint = newPath[pointIndex + 1];
                         if (Math.abs(oldPoint.x - nextPoint.x) > Math.abs(oldPoint.y - nextPoint.y)) { // Was horizontal segment
                            newPath[pointIndex+1] = {...nextPoint, y: newPointY};
                        } else { // Was vertical segment
                             newPath[pointIndex+1] = {...nextPoint, x: newPointX};
                        }
                    }
                    // Ensure start/end points remain connected to fibers
                    if(pointIndex === 0) {
                        const fiber1 = getFiberById(conn.fiber1Id);
                        if(fiber1) newPath[0] = fiber1.exitPoint;
                    }
                    if(pointIndex === newPath.length -1) {
                        const fiber2 = getFiberById(conn.fiber2Id);
                        if(fiber2) newPath[newPath.length-1] = fiber2.exitPoint;
                    }


                    return { ...conn, path: newPath, controlPoints: newPath.map(p => ({...p, radius: CONNECTION_CONTROL_POINT_RADIUS})) };
                }
                return conn;
            }));
        }
    }, [draggingCableInfo, draggingControlPoint, width, height, calculateLayout, getFiberById]);

    const handleMouseUp = useCallback(() => {
        if (draggingCableInfo) {
            setManagedCables(prev => prev.map(c => c.id === draggingCableInfo.cableId ? {...c, dragHandle: {...c.dragHandle, isActive: false}} : c));
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