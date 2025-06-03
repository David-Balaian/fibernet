import { colors } from '@mui/material';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { save3DConnectionsToLocalStorage } from 'src/utils/helperFunctions';
import { ControlPointData, FiberConnection, InitialConnectionObject } from 'src/utils/threeJSHelpers/fiberConnections';
import { getOpticalCableScenes } from 'src/utils/threeJSHelpers/OpticalCableDrawer';
import { ICable, IFiber } from 'src/utils/threeJSHelpers/types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface OpticalCableProps {
    cables: ICable[]
}

const OpticalCable: React.FC<OpticalCableProps> = ({ cables }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef<boolean>(false);
    
    const scene = useRef(new THREE.Scene()).current;
    const camera = useRef(new THREE.PerspectiveCamera(75, 1, 0.1, 1000)).current;
    const renderer = useRef<THREE.WebGLRenderer | null>(null);
    const controls = useRef<OrbitControls | null>(null);
    const [cameraPosition, setCameraPosition] = useState<string>('');
    const [selectedFiber, setSelectedFiber] = useState<{ index: number, cableType: 'in' | 'out' } | null>(null);
    const isDragging = useRef(false)
    const raycaster = useRef(new THREE.Raycaster()).current;
    const mouse = useRef(new THREE.Vector2()).current;
    const originalMaterials = useRef(new WeakMap()).current;
    const hoveredFiber = useRef<THREE.Object3D | null>(null);
    const selectedCable = useRef<THREE.Object3D | null>(null);
    const connections = useRef<FiberConnection[]>([]);
    const [selectedFibers, setSelectedFibers] = useState<THREE.Mesh[]>([]);
    const [activeConnection, setActiveConnection] = useState<FiberConnection | null>(null);
    const [selectedControlPoint, setSelectedControlPoint] = useState<number | null>(null);
    const dragOffset = useRef<THREE.Vector3 | null>(null);
    const [editingConnection, setEditingConnection] = useState<FiberConnection | null>(null);
    const isDraggingControlPoint = useRef(false);

    const [random, setRandom] = useState(Math.random());

    // Store more info for dragging: the control point's mesh, its connection, its index, the drag plane, and initial offset
    const selectedControlPointInfo = useRef<{
        mesh: THREE.Mesh,
        connection: FiberConnection,
        pointIndex: number,
        dragPlane: THREE.Plane,
        dragOffset: THREE.Vector3
    } | null>(null);

    const controlPointHelpers = useRef<THREE.Mesh[]>([]);

    console.log(connections.current, "connections.current");

    /**
     * Finds a fiber THREE.Mesh within allFibers based on its globally unique ID.
     * Assumes fiberMesh.userData.id contains the unique fiber ID.
     * @param fiberId The unique ID of the fiber to find.
     * @param currentAllFibers The array of fiber arrays (THREE.Mesh[][]).
     * @returns The THREE.Mesh for the fiber, or null if not found.
     */
    const findFiberMeshByGlobalId = (
        fiberId: string,
        currentAllFibers: THREE.Mesh[][]
    ): THREE.Mesh | null => {
        if (!fiberId || !currentAllFibers) return null;
        for (const fiberArray of currentAllFibers) {
            for (const fiberMesh of fiberArray) {
                if (fiberMesh.userData.fiberId === fiberId) { // Crucial check
                    return fiberMesh;
                }
            }
        }
        // console.warn(`Could not find fiber mesh with global ID: ${fiberId}`);
        return null;
    };


    const createInitialConnections = (
        initialConnectionDefs: InitialConnectionObject[],
        currentAllFibers: THREE.Mesh[][],
        sceneInstance: THREE.Scene
    ) => {
        if (!initialConnectionDefs || initialConnectionDefs.length === 0) {
            // console.log("No initial connections to create.");
            return;
        }
        if (!currentAllFibers || currentAllFibers.length === 0 || !sceneInstance) {
            console.warn("Cannot create initial connections: fiber meshes or scene not ready.");
            return;
        }

        // console.log(`Attempting to create ${initialConnectionDefs.length} initial connections.`);
        const newConnections: FiberConnection[] = [];

        initialConnectionDefs.forEach((connDef, index) => {
            const fiber1Mesh = findFiberMeshByGlobalId(connDef.fiber1Id, currentAllFibers);
            const fiber2Mesh = findFiberMeshByGlobalId(connDef.fiber2Id, currentAllFibers);

            if (fiber1Mesh && fiber2Mesh) {
                // Ensure they are valid THREE.Mesh instances (though findFiberMeshByGlobalId should ensure this)
                if (!(fiber1Mesh instanceof THREE.Mesh) || !(fiber2Mesh instanceof THREE.Mesh)) {
                    console.warn(`Objects found for initial connection ${index} are not THREE.Mesh instances.`);
                    return; // Skip this connection definition
                }

                // The 'points' from connDef directly match ControlPointData[] for the constructor
                const controlPointsForConstructor: ControlPointData[] = connDef.points;

                const connection = new FiberConnection(
                    fiber1Mesh,
                    fiber2Mesh,
                    controlPointsForConstructor
                );
                sceneInstance.add(connection.getMesh());
                newConnections.push(connection);
                // console.log(`Successfully created initial connection ${index} between ${connDef.fiber1Id} and ${connDef.fiber2Id}`);
            } else {
                console.warn(`Failed to create initial connection ${index}: Could not find fiber meshes. Fiber1 ID: ${connDef.fiber1Id} (found: ${!!fiber1Mesh}), Fiber2 ID: ${connDef.fiber2Id} (found: ${!!fiber2Mesh})`);
            }
        });

        // Decide how to handle existing connections:
        // Option 1: Append to existing (if any from localStorage, though order might be tricky)
        // connections.current = [...connections.current, ...newConnections];

        // Option 2: Replace existing connections with these initial ones (simpler if these are defaults)
        // First, dispose and remove any existing connections if replacing everything
        connections.current.forEach(existingConn => {
            sceneInstance.remove(existingConn.getMesh());
            existingConn.dispose();
        });
        connections.current = newConnections;


        // console.log(`Total initial connections created: ${newConnections.length}`);
        // After creating these, you might want to save them to localStorage if that's still desired
        // saveConnections(); // If you want these initial connections to overwrite localStorage
    };



    useEffect(() => {
        if(connections.current.length)
        save3DConnectionsToLocalStorage(connections.current)
    }, [connections.current, random]);




    const clearControlPointHelpers = () => {
        controlPointHelpers.current.forEach(helper => scene.remove(helper));
        controlPointHelpers.current = [];
        console.log("removed controlPointHelpers");

    };

    const showControlPointHelpers = (connection: FiberConnection) => {
        clearControlPointHelpers(); // Clear any existing helpers
        // Use the new method from FiberConnection:
        const editablePoints = connection.getPotentialEditablePointsWorldPositions();

        editablePoints.forEach((point, index) => { // index will be 0, 1, 2, 3
            const geometry = new THREE.SphereGeometry(0.07, 32, 32);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false });

            const helper = new THREE.Mesh(geometry, material);
            helper.position.copy(point);
            helper.userData = {
                isControlPoint: true,
                connectionInstance: connection, // Link back to the connection
                pointIndex: index // This will be 0, 1, 2, or 3 for the 4 points
            };
            scene?.add(helper);
            controlPointHelpers.current.push(helper);
        });
    };


    const handleDeleteConnection = () => {
        if (!editingConnection) {
            console.warn("[OpticalCable] No connection selected to delete.");
            return;
        }

        console.log("[OpticalCable] Deleting connection:", editingConnection);

        // 1. Remove the connection's mesh from the scene
        scene.remove(editingConnection.getMesh());

        // 2. Call dispose on the FiberConnection instance
        editingConnection.dispose(); // Make sure this method exists and works in FiberConnection.ts

        // 3. Remove the connection from the connections.current array
        connections.current = connections.current.filter(conn => conn !== editingConnection);

        // 4. Clear visual helpers for control points
        clearControlPointHelpers();

        // 5. Reset the editingConnection state
        setEditingConnection(null);

        setSelectedFibers([]); // Clear any selected fibers
        setSelectedFiber(null); // Clear selected fiber state
    };




    // const [selectedCable, setSelectedCable] = useState<THREE.Object3D | null>(null);


    // Generate cable scenes
    // const {
    //     mainCableScene: inCable,
    //     fibersScene: inCableFibers,
    //     interactivityObjects: inCableInteractivity
    // } = useMemo(() => getOpticalCableScenes(fibers, "in"), [fibers]);

    // const {
    //     mainCableScene: outCable,
    //     fibersScene: outCableFibers,
    //     interactivityObjects: outCableInteractivity
    // } = useMemo(() => getOpticalCableScenes(fibers, "out"), [fibers]);
    const {
        allFibers,
        allInteractiveObjects,
        allCables,
        allCableGroups
    } = useMemo(() => {
        const allFibers: ReturnType<typeof getOpticalCableScenes>["fibersScene"][] = []
        const allCables: ReturnType<typeof getOpticalCableScenes>["mainCableScene"][] = []
        const allInteractiveObjects: ReturnType<typeof getOpticalCableScenes>["interactivityObjects"][] = []
        const allCableGroups: ReturnType<typeof getOpticalCableScenes>["cableGroup"][] = []
        let inCableIndex = 0
        let outCableIndex = 0
        cables.forEach((cable) => {
            const {
                cableGroup,
                mainCableScene,
                fibersScene,
                interactivityObjects
            } = getOpticalCableScenes(cable.fibers, cable.type, cable.type === "in" ? inCableIndex : outCableIndex, cable.id);
            allFibers.push(fibersScene)
            allCables.push(mainCableScene)
            allCableGroups.push(cableGroup)
            allInteractiveObjects.push(interactivityObjects)
            if (cable.type === "in") {
                inCableIndex++
            } else if (cable.type === "out") {
                outCableIndex++
            }
        })

        return {
            allFibers,
            allCables,
            allInteractiveObjects,
            allCableGroups,
        }
    }, [cables])


    
    useEffect(()=>{
        const initialConnections = localStorage.getItem("connections3D");
        console.log(initialConnections);
        
        if(initialConnections && allFibers.length && scene) {
            console.log(allFibers);
            
            const parsedConnections: InitialConnectionObject[] = JSON.parse(initialConnections);
            console.log("Parsed initial connections from localStorage:", parsedConnections);
            createInitialConnections(parsedConnections, allFibers, scene);
        }
    }, [allFibers, scene]);

    useEffect(() => {
        if (!mountRef.current) return;

        // ... (originalMaterials setup - keep as is) ...
        allFibers.forEach(fibersArray => {
            fibersArray.forEach((fiber) => {
                if (!originalMaterials.has(fiber)) {
                    originalMaterials.set(fiber, (fiber as THREE.Mesh).material);
                }
            });
        });

        const currentMountRef = mountRef.current;

        const handleMouseDown = (event: MouseEvent) => {
            if (!currentMountRef) return;
            const rect = currentMountRef.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            // 1. Check for Control Point Intersection FIRST
            const controlPointIntersects = raycaster.intersectObjects(controlPointHelpers.current);
            if (controlPointIntersects.length > 0) {
                const intersectedCPMesh = controlPointIntersects[0].object as THREE.Mesh;
                const { connectionInstance, pointIndex } = intersectedCPMesh.userData;

                console.log('[OpticalCable] MouseDown on ControlPoint:', pointIndex);

                isDragging.current = false; // Ensure not dragging cable
                isDraggingControlPoint.current = true;
                if (controls.current) controls.current.enabled = false;

                // Create a plane perpendicular to the camera view, passing through the control point
                const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
                const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, intersectedCPMesh.position);

                // Calculate intersection point of ray with this plane
                const intersectionPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, intersectionPoint); // Populates intersectionPoint

                // Calculate offset from control point's actual position to this intersection point
                const dragOffset = new THREE.Vector3().subVectors(intersectedCPMesh.position, intersectionPoint);

                selectedControlPointInfo.current = {
                    mesh: intersectedCPMesh,
                    connection: connectionInstance as FiberConnection,
                    pointIndex: pointIndex as number,
                    dragPlane: dragPlane,
                    dragOffset: dragOffset
                };
                currentMountRef.style.cursor = 'grabbing';
                return; // Prioritize control point dragging
            }

            // 2. Check for Cable Group Intersection (for dragging whole cables)
            // ... (your existing cable dragging mousedown logic - ensure it doesn't run if a CP was hit)
            // (Make sure this part is largely the same as your working version)
            const cableIntersects = raycaster.intersectObjects(allCableGroups, true);
            if (cableIntersects.length > 0) {
                let intersectedObject = cableIntersects[0].object;
                let cableGroupToDrag = null;
                let tempObj: THREE.Object3D | null = intersectedObject;
                while (tempObj && tempObj !== scene) { // Ensure tempObj is not null before accessing parent
                    if (allCableGroups.includes(tempObj as THREE.Group)) {
                        cableGroupToDrag = tempObj as THREE.Group;
                        break;
                    }
                    tempObj = tempObj.parent;
                }

                if (cableGroupToDrag && !intersectedObject.userData.isFiber && !intersectedObject.userData.isControlPoint) {
                    controls.current!.enabled = false;
                    isDragging.current = true;
                    // isDraggingControlPoint.current = false; // Already false if we reached here
                    selectedCable.current = cableGroupToDrag;

                    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -cableGroupToDrag.position.z);
                    const target = new THREE.Vector3();
                    raycaster.ray.intersectPlane(planeZ, target); // Populates target
                    if (target) { // Check if intersection occurred
                        dragOffset.current = new THREE.Vector3().subVectors(cableGroupToDrag.position, target);
                    } else {
                        // Fallback if ray doesn't intersect plane, though unlikely for this setup
                        dragOffset.current = new THREE.Vector3();
                    }
                    currentMountRef.style.cursor = 'grabbing';
                    return;
                }
            }
            currentMountRef.style.cursor = 'default';
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (!currentMountRef) return;

            const rect = currentMountRef.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            // 1. Active Dragging Takes Precedence (Control Point or Cable)
            // These blocks should return early if a drag is active.

            if (isDraggingControlPoint.current && selectedControlPointInfo.current) {
                const { mesh: cpMesh, connection, pointIndex, dragPlane, dragOffset } = selectedControlPointInfo.current;
                const targetPositionForCP = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(dragPlane, targetPositionForCP)) {
                    const newPos = targetPositionForCP.add(dragOffset);
                    cpMesh.position.copy(newPos);
                    connection.setControlPointWorld(pointIndex, newPos);
                }
                currentMountRef.style.cursor = 'grabbing';
                setRandom(Math.random())
                return; // Dragging CP, no other mousemove logic needed
            }

            if (isDragging.current && selectedCable.current && dragOffset.current) {
                const targetPositionForCable = new THREE.Vector3();
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                const verticalThreshold = 0.7;
                const isTopDownView = Math.abs(cameraDirection.y) > verticalThreshold;
                let planeIntersected = false;

                if (isTopDownView) {
                    const xzPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -selectedCable.current.position.y);
                    planeIntersected = !!raycaster.ray.intersectPlane(xzPlane, targetPositionForCable);
                } else {
                    const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -selectedCable.current.position.z);
                    planeIntersected = !!raycaster.ray.intersectPlane(xyPlane, targetPositionForCable);
                }

                if (planeIntersected) {
                    const newX = targetPositionForCable.x + dragOffset.current.x;
                    const newY = isTopDownView ? selectedCable.current.position.y : targetPositionForCable.y + dragOffset.current.y;
                    const newZ = isTopDownView ? targetPositionForCable.z + dragOffset.current.z : selectedCable.current.position.z;
                    selectedCable.current.position.set(newX, newY, newZ);

                    connections.current.forEach(conn => {
                        const fiber1Parent = conn.fiber1.parent;
                        const fiber2Parent = conn.fiber2.parent;
                        if (fiber1Parent === selectedCable.current || fiber2Parent === selectedCable.current) {
                            conn.update();
                        }
                    });
                }
                currentMountRef.style.cursor = 'grabbing';
                return; // Dragging cable, no other mousemove logic needed
            }

            // 2. Hover Effects (if not dragging anything)

            // A. Reset previous fiber hover effect FIRST
            if (hoveredFiber.current) {
                const originalMaterial = originalMaterials.get(hoveredFiber.current);
                if (originalMaterial) {
                    (hoveredFiber.current as THREE.Mesh).material = originalMaterial;
                }
                // else { console.warn("Original material not found for previously hovered fiber", hoveredFiber.current.name); }

                if (hoveredFiber.current.userData.originalX !== undefined) {
                    hoveredFiber.current.position.x = hoveredFiber.current.userData.originalX;
                }
                hoveredFiber.current = null;
            }

            // B. Raycast for new hover targets
            // We check control points first, then all parts of cable groups (which includes fibers and sheaths)
            const hoverableObjects: THREE.Object3D[] = [
                ...controlPointHelpers.current, // Give CPs higher priority in the list if order matters to intersectObjects for identical distance
                ...allCableGroups
            ];
            const intersects = raycaster.intersectObjects(hoverableObjects, true); // true for recursive

            // C. Process the closest hit for hover effects
            if (intersects.length > 0) {
                const firstHit = intersects[0].object;

                // Is it a Control Point Helper?
                if (controlPointHelpers.current.includes(firstHit as THREE.Mesh)) {
                    currentMountRef.style.cursor = 'pointer'; // Or 'grab' to indicate draggability
                    // No other visual effect for CP hover in this example, but you could add one.
                    // Since a CP is hovered, we don't want fiber or cable sheath hover effects.
                }
                // Is it a Fiber? (and not a CP, because CPs are checked first)
                else if (firstHit.userData.isFiber) {
                    hoveredFiber.current = firstHit as THREE.Mesh;

                    // Store original material if not already stored (important for hover effect)
                    if (!originalMaterials.has(hoveredFiber.current)) {
                        originalMaterials.set(hoveredFiber.current, (hoveredFiber.current as THREE.Mesh).material);
                    }
                    // Store original X position for hover displacement
                    if (hoveredFiber.current.userData.originalX === undefined) {
                        hoveredFiber.current.userData.originalX = hoveredFiber.current.position.x;
                    }

                    // Apply visual hover effect (e.g., slight displacement)
                    hoveredFiber.current.position.x = hoveredFiber.current.userData.originalX + (hoveredFiber.current.userData.cableType === 'in' ? 0.05 : -0.05);
                    // Optionally, change material for hover:
                    // (hoveredFiber.current as THREE.Mesh).material = someHoverMaterial;

                    currentMountRef.style.cursor = 'pointer';
                }
                // Is it another part of a Cable Group (e.g., sheath)? (and not a CP or Fiber)
                else {
                    // Check if firstHit is a descendant of any group in allCableGroups
                    // This helps confirm it's not some other unrelated scene object if hoverableObjects included more.
                    let isCableComponent = false;
                    for (const group of allCableGroups) {
                        if (group.getObjectById(firstHit.id)) { // Checks if firstHit is child of this group
                            isCableComponent = true;
                            break;
                        }
                    }

                    if (isCableComponent) {
                        // console.log("Hovering over cable sheath/part:", firstHit.name);
                        // Set cursor for cable body hover, e.g., if the cable itself is selectable/draggable
                        // currentMountRef.style.cursor = 'move'; // Example if cables are draggable via any part
                        currentMountRef.style.cursor = 'default'; // Or keep default if no specific cable body hover interaction
                        // Ensure no fiber hover effect is active (already cleared at the start of this section)
                    } else {
                        // Hit something else that was in hoverableObjects but not handled above
                        currentMountRef.style.cursor = 'default';
                    }
                }
            } else {
                // No intersections with any hoverable objects
                currentMountRef.style.cursor = 'default';
            }
        };

        const handleMouseUp = () => {
            let cursorShouldBePointer = false; // Check if mouse is still over a CP after drag

            if (isDraggingControlPoint.current) {
                console.log('[OpticalCable] MouseUp after dragging ControlPoint');
                isDraggingControlPoint.current = false;
                // selectedControlPointInfo.current = null; // Keep info if we want to highlight on hover
                if (controls.current) controls.current.enabled = true;

                // Check if still hovering over a control point to set cursor correctly
                if (selectedControlPointInfo.current?.mesh) {
                    const cpBoundingBox = new THREE.Box3().setFromObject(selectedControlPointInfo.current.mesh);
                    if (raycaster.ray.intersectsBox(cpBoundingBox)) { // simple check, assumes mouse didn't move for this check
                        cursorShouldBePointer = true;
                    }
                }
                selectedControlPointInfo.current = null; // Clear selection after checks
            }

            if (isDragging.current) {
                isDragging.current = false;
                if (controls.current) controls.current.enabled = true;
                // selectedCable.current = null; // Clearing this means it can't be immediately clicked without re-mousedown
            }

            if (currentMountRef) {
                // If mouse is up, check current hover state for cursor if not dragging anymore
                const rect = currentMountRef.getBoundingClientRect();
                // Use last known mouse position for raycaster (or re-fetch if event is available)
                // mouse.x, mouse.y are already set from last mousemove
                raycaster.setFromCamera(mouse, camera); // mouse coords from last move

                const cpIntersects = raycaster.intersectObjects(controlPointHelpers.current);
                if (cpIntersects.length > 0 && cpIntersects[0].object.userData.isControlPoint) {
                    cursorShouldBePointer = true;
                }

                currentMountRef.style.cursor = cursorShouldBePointer ? 'pointer' : 'default';
            }
        };

        // handleClick should remain largely the same as your working version for selection
        // Just ensure it doesn't interfere with drag completion.
        // The isDragging.current and isDraggingControlPoint.current flags should prevent
        // click logic from firing immediately after a drag if checked at the start of handleClick.
        const handleClick = (event: MouseEvent) => {
            // Standard check: if a drag operation was just happening, often we want to suppress a 'click'.
            // The mouseup handlers should set isDragging flags to false.
            // This check is a safeguard or for more nuanced drag-click distinction if needed.
            if (!currentMountRef || isDragging.current || isDraggingControlPoint.current) {
                // console.log("[OpticalCable] Click suppressed due to active drag operation.");
                return;
            }
            // console.log('[OpticalCable] handleClick triggered');

            const rect = currentMountRef.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            // Order of precedence for clicks:
            // 1. Control Point Helpers (most specific UI element)
            // 2. Connection Tubes (visual representation of established connections)
            // 3. Cable Groups (which include fibers and cable sheaths - closest part first)
            // 4. Empty space

            // 1. Check Control Points
            const cpIntersects = raycaster.intersectObjects(controlPointHelpers.current);
            if (cpIntersects.length > 0) {
                // console.log("[OpticalCable] Clicked on a control point helper.");
                // Typically, mousedown on a CP initiates drag, click might do nothing or select its connection.
                // For now, if a CP is clicked, we consume the event and do nothing else here.
                // You could add logic here to select the CP's associated connection if desired:
                // const { connectionInstance } = cpIntersects[0].object.userData;
                // if (editingConnection !== connectionInstance) {
                //     setEditingConnection(connectionInstance);
                //     showControlPointHelpers(connectionInstance);
                //     setSelectedFibers([]); // Clear any pending fiber selections
                // }
                return; // Click handled (or intentionally ignored for CP click action)
            }

            // 2. Check Connection Tubes
            const connectionTubeMeshes: THREE.Mesh[] = [];
            connections.current.forEach(conn => {
                conn.getMesh().children.forEach(child => { // Assuming getMesh() returns a Group
                    if (child instanceof THREE.Mesh) {
                        connectionTubeMeshes.push(child);
                    }
                });
            });
            const connectionIntersects = raycaster.intersectObjects(connectionTubeMeshes);
            if (connectionIntersects.length > 0) {
                const intersectedTube = connectionIntersects[0].object;
                if (intersectedTube.parent && intersectedTube.parent.userData.isConnection) {
                    const clickedConnection = intersectedTube.parent.userData.connectionInstance as FiberConnection;
                    // console.log("[OpticalCable] Clicked on a connection tube.", clickedConnection);
                    if (editingConnection === clickedConnection) {
                        // Optional: Clicking an already selected connection could deselect it
                        // setEditingConnection(null);
                        // clearControlPointHelpers();
                    } else {
                        setEditingConnection(clickedConnection);
                        showControlPointHelpers(clickedConnection);
                        setSelectedFibers([]); // Clear any pending fiber selections
                    }
                    return; // Click handled
                }
            }

            // 3. Check Cable Groups (this will include fibers and cable sheaths)
            // The raycaster sorts by distance, so the first element is the closest.
            const cableAndFiberIntersects = raycaster.intersectObjects(allCableGroups, true); // true for recursive

            if (cableAndFiberIntersects.length > 0) {
                const firstHitObject = cableAndFiberIntersects[0].object;

                if (firstHitObject.userData.isFiber) {
                    // console.log("[OpticalCable] Clicked on a Fiber.");
                    const clickedFiber = firstHitObject as THREE.Mesh;

                    // If a connection is being edited, clicking a fiber should stop that editing.
                    if (editingConnection) {
                        setEditingConnection(null);
                        clearControlPointHelpers();
                    }
                    setSelectedFiber({ // For UI display state
                        index: clickedFiber.userData.fiberIndex,
                        cableType: clickedFiber.userData.cableType
                    });

                    // Fiber selection logic for creating a new connection:
                    const originalMaterial = originalMaterials.get(clickedFiber) || clickedFiber.material;
                    if (selectedFibers.length === 0) {
                        setSelectedFibers([clickedFiber]);
                        // Visual feedback for first selection
                        (clickedFiber as THREE.Mesh).material = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0x555500 });
                    } else if (selectedFibers.length === 1 && selectedFibers[0] !== clickedFiber) {
                        // Second fiber selection - create connection
                        const fiber1 = selectedFibers[0];
                        const fiber2 = clickedFiber;

                        // Revert first fiber's material
                        const firstFiberOriginalMaterial = originalMaterials.get(fiber1) || fiber1.material;
                        (fiber1 as THREE.Mesh).material = firstFiberOriginalMaterial;

                        const newConnection = new FiberConnection(fiber1, fiber2);
                        scene.add(newConnection.getMesh());
                        connections.current = [...connections.current, newConnection];
                        setSelectedFibers([]); // Reset for next connection
                    } else if (selectedFibers.length === 1 && selectedFibers[0] === clickedFiber) {
                        // Clicked the same fiber again - deselect
                        (clickedFiber as THREE.Mesh).material = originalMaterial;
                        setSelectedFibers([]);
                    }
                    return; // Fiber click handled
                } else {
                    // Clicked on a part of a cable group that is NOT a fiber (e.g., the cable sheath)
                    // console.log("[OpticalCable] Clicked on a Cable Sheath/Part:", firstHitObject);

                    // Action: Deselect any active connection or pending fiber selections.
                    if (editingConnection) {
                        setEditingConnection(null);
                        clearControlPointHelpers();
                    }
                    if (selectedFibers.length > 0) {
                        const firstFiberOriginalMaterial = originalMaterials.get(selectedFibers[0]) || selectedFibers[0].material;
                        (selectedFibers[0] as THREE.Mesh).material = firstFiberOriginalMaterial; // Revert material
                        setSelectedFibers([]);
                    }
                    setSelectedFiber(null); // Clear single fiber display
                    // You might want to select the cable itself here if you have such a feature.
                    return; // Cable sheath click handled, preventing click-through to underlying fibers.
                }
            }

            // 4. If nothing interactive was hit (empty space click)
            // console.log("[OpticalCable] Clicked on empty space.");
            if (editingConnection) {
                setEditingConnection(null);
                clearControlPointHelpers();
            }
            if (selectedFibers.length > 0) {
                // Revert material of the first selected fiber if clicking away
                const firstFiberOriginalMaterial = originalMaterials.get(selectedFibers[0]) || selectedFibers[0].material;
                (selectedFibers[0] as THREE.Mesh).material = firstFiberOriginalMaterial;
                setSelectedFibers([]);
            }
            setSelectedFiber(null); // Clear UI display
        };

        // ... (event listener setup and cleanup in useEffect) ...
        // Make sure 'window' is used for mouseup to catch drags outside the canvas
        currentMountRef.addEventListener('mousedown', handleMouseDown);
        currentMountRef.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp); // IMPORTANT: use window
        currentMountRef.addEventListener('click', handleClick);

        return () => {
            currentMountRef.removeEventListener('mousedown', handleMouseDown);
            currentMountRef.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp); // IMPORTANT: use window
            currentMountRef.removeEventListener('click', handleClick);
            // clearControlPointHelpers();
        };

    }, [camera, allCableGroups, allFibers, connections, editingConnection, selectedFibers, originalMaterials, controls, raycaster, mouse]); // Add relevant dependencies

    // expanded

    // useEffect for Three.js setup (renderer, camera, lights, etc.)
    // ... (keep your existing setup useEffect largely as is)
    // Make sure its dependency array is correct.
    // The dependency for adding objects to scene is allCableGroups. Connections are added dynamically.
    useEffect(() => {
        // ... (your existing setup code for renderer, camera, initial objects) ...
        // Ensure initial connections are also added if they exist from a saved state (not current)
        connections.current.forEach(conn => scene.add(conn.getMesh()));


        // Cleanup for this effect
        return () => {
            // ... (your existing cleanup: remove resize listener, dispose controls, renderer)
            // Remove all dynamically added objects that are not part of allCableGroups
            connections.current.forEach(conn => scene.remove(conn.getMesh()));
            clearControlPointHelpers(); // Also clear helpers here
            // The allCableGroups are removed as per your existing code
        };
    }, [allCables, allFibers, allCableGroups]); // Keep existing dependencies, or refine



    useEffect(() => {
        if (!mountRef.current) return;
        isMounted.current = true
        // Initialize renderer
        renderer.current = new THREE.WebGLRenderer({ antialias: true });
        const rendererInstance = renderer.current;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        rendererInstance.setSize(width, height);
        rendererInstance.setClearColor(0xf0f0f0);
        mountRef.current.appendChild(rendererInstance.domElement);

        // Camera setup
        camera.aspect = width / height;
        camera.position.set(0.28, 4.36, 2.55);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // Controls setup
        controls.current = new OrbitControls(camera, rendererInstance.domElement);
        controls.current.enableDamping = true;
        controls.current.dampingFactor = 0.1;

        controls.current.addEventListener('change', () => {
            const pos = camera.position;
            setCameraPosition(`(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        scene.add(directionalLight);

        // Add cables to scene
        allCableGroups.forEach(cable => scene.add(cable));

        // Add coordinate axes helper
        // Create AxesHelper
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        // Function to create a TextSprite
        const createTextSprite = (text: string, color: string): THREE.Sprite => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 128;
            canvas.height = 128;
            context.font = '48px Arial';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(0.5, 0.5, 0.5); // Adjust size of the label
            return sprite;
        };

        // Add axis labels
        const xLabel = createTextSprite('X', 'red');
        xLabel.position.set(5.5, 0, 0); // Slightly beyond the X axis end
        scene.add(xLabel);

        const yLabel = createTextSprite('Y', 'green');
        yLabel.position.set(0, 5.5, 0); // Slightly beyond the Y axis end
        scene.add(yLabel);

        const zLabel = createTextSprite('Z', 'blue');
        zLabel.position.set(0, 0, 5.5); // Slightly beyond the Z axis end
        scene.add(zLabel);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            controls.current?.update();
            rendererInstance.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!mountRef.current) return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            rendererInstance.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            controls.current?.removeEventListener('change', () => { });
            controls.current?.dispose();
            allCableGroups.forEach(cable => scene.remove(cable));
            mountRef.current?.removeChild(rendererInstance.domElement);
            rendererInstance.dispose();
        };
    }, [allCables, allFibers, allCableGroups]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                fontFamily: 'monospace'
            }}>
                Camera Position: {cameraPosition || 'Loading...'}
                {selectedFiber && (
                    <div style={{ marginTop: '8px' }}>
                        Selected Fiber: {selectedFiber.index} |
                        Cable: {selectedFiber.cableType} |
                        {/* Color: {fibers[selectedFiber.index].color} */}
                    </div>
                )}

            </div>
            {editingConnection && ( // Only show if a connection is being "edited" (helpers are visible)
                <button
                    onClick={handleDeleteConnection}
                    style={{
                        position: 'absolute',
                        bottom: '20px', // Adjust as needed for spacing from other UI
                        left: '300px', // Example: to the right of the info box, adjust width (200px) as needed
                        // If you want it truly bottom-left most, use left: '20px' and adjust bottom relative to other elements
                        // For now, placing it to the right of the existing info box:
                        // left: '20px', // if you want it stacked or need to adjust other UI
                        // bottom: '60px', // if stacking above info box
                        padding: '8px 15px',
                        backgroundColor: 'rgba(220, 53, 69, 0.8)', // Bootstrap danger red, with some transparency
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        zIndex: 10 // Ensure it's above the canvas
                    }}
                >
                    Delete Connection
                </button>
            )}
        </div>
    );
};


const OpticalCableVisualizer: React.FC<{ cables: ICable[] }> = ({ cables }) => {

    return (
        <div>
            <div style={{ margin: '0 auto' }}>
                <OpticalCable cables={cables} />
            </div>
        </div>
    );
};

export default OpticalCableVisualizer;