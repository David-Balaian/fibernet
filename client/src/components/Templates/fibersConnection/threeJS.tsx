import { colors } from '@mui/material';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { save3DConnectionsToLocalStorage } from 'src/utils/helperFunctions';
import { ControlPointData, FiberConnection, InitialConnectionObject } from 'src/utils/threeJSHelpers/fiberConnections';
import { getOpticalCableScenes } from 'src/utils/threeJSHelpers/OpticalCableDrawer';
import { ICable, IFiber, ISplitter } from 'src/utils/threeJSHelpers/types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ConnectionManager } from 'src/utils/threeJSHelpers/ConnectionManager';
import { createSplitter } from 'src/utils/threeJSHelpers/SplitterDrawer';

interface OpticalCableProps {
    cables: ICable[];
    objectsOnCanvas?: ISplitter[];
}

const OpticalCable: React.FC<OpticalCableProps> = ({ cables, objectsOnCanvas: splitters }) => {
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

    const isRotating = useRef(false);

    const rotationInfo = useRef<{
        startX: number;
        initialRotation: THREE.Euler;
    } | null>(null);

    const dragInfo = useRef<{
        plane: THREE.Plane;
        offset: THREE.Vector3;
    } | null>(null);

    const [editingConnection, setEditingConnection] = useState<FiberConnection | null>(null);
    const isDraggingControlPoint = useRef(false);

    const [random, setRandom] = useState(Math.random());

    const connectionManager = useRef(new ConnectionManager()).current;

    const selectedControlPointInfo = useRef<{
        mesh: THREE.Mesh,
        connection: FiberConnection,
        pointIndex: number,
        dragPlane: THREE.Plane,
        dragOffset: THREE.Vector3
    } | null>(null);

    const controlPointHelpers = useRef<THREE.Mesh[]>([]);

    console.log(connections.current, "connections.current");

    const findFiberMeshByGlobalId = (
        fiberId: string,
        connectableObjects: THREE.Mesh[]
    ): THREE.Mesh | null => {
        if (!fiberId || !connectableObjects) return null;
        for (const mesh of connectableObjects) {
            if (mesh.userData.fiberId === fiberId) {
                return mesh;
            }
        }
        return null;
    }

    const createInitialConnections = (
        initialConnectionDefs: InitialConnectionObject[],
        allConnectableObjects: THREE.Mesh[],
        sceneInstance: THREE.Scene
    ) => {
        if (!initialConnectionDefs || initialConnectionDefs.length === 0) {
            return;
        }
        if (!allConnectableObjects || allConnectableObjects.length === 0 || !sceneInstance) {
            console.warn("Cannot create initial connections: connectable objects or scene not ready.");
            return;
        }

        const newConnections: FiberConnection[] = [];

        initialConnectionDefs.forEach((connDef, index) => {
            const fiber1Mesh = findFiberMeshByGlobalId(connDef.fiber1Id, allConnectableObjects);
            const fiber2Mesh = findFiberMeshByGlobalId(connDef.fiber2Id, allConnectableObjects);

            if (fiber1Mesh && fiber2Mesh) {
                const connection = new FiberConnection(
                    fiber1Mesh,
                    fiber2Mesh,
                    connectionManager,
                    connDef.points
                );
                sceneInstance.add(connection.getMesh());
                newConnections.push(connection);
            } else {
                console.warn(`Failed to create initial connection ${index}: Could not find one or both meshes. Fiber1 ID: ${connDef.fiber1Id}, Fiber2 ID: ${connDef.fiber2Id}`);
            }
        });

        connections.current.forEach(existingConn => {
            sceneInstance.remove(existingConn.getMesh());
            existingConn.dispose();
        });
        connections.current = newConnections;
    };

    useEffect(() => {
        if (connections.current.length)
            save3DConnectionsToLocalStorage(connections.current)
    }, [connections.current, random]);

    const clearControlPointHelpers = () => {
        controlPointHelpers.current.forEach(helper => scene.remove(helper));
        controlPointHelpers.current = [];
        console.log("removed controlPointHelpers");
    };

    const showControlPointHelpers = (connection: FiberConnection) => {
        clearControlPointHelpers();
        const editablePoints = connection.getPotentialEditablePointsWorldPositions();

        editablePoints.forEach((point, index) => {
            const geometry = new THREE.SphereGeometry(0.07, 32, 32);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false });

            const helper = new THREE.Mesh(geometry, material);
            helper.position.copy(point);
            helper.userData = {
                isControlPoint: true,
                connectionInstance: connection,
                pointIndex: index
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
        scene.remove(editingConnection.getMesh());
        editingConnection.dispose();
        connections.current = connections.current.filter(conn => conn !== editingConnection);
        clearControlPointHelpers();
        setEditingConnection(null);
        setSelectedFibers([]);
        setSelectedFiber(null);
    };

    const {
        allCables,
        allFibers,
        allCableGroups,
        allSplitterGroups,
        allConnectables,
    } = useMemo(() => {
        const allFibersArrays: ReturnType<typeof getOpticalCableScenes>["fibersScene"][] = []
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
            } = getOpticalCableScenes(cable.fibers, cable.type, cable.type === "in" ? inCableIndex : outCableIndex, cable.id, cable.tubes);
            allFibersArrays.push(fibersScene)
            allCables.push(mainCableScene)
            allCableGroups.push(cableGroup)
            allInteractiveObjects.push(interactivityObjects)
            if (cable.type === "in") {
                inCableIndex++
            } else if (cable.type === "out") {
                outCableIndex++
            }
        })

        const allSplitterGroups: THREE.Group[] = [];
        const allSplitterPorts: THREE.Mesh[] = [];
        if (splitters) {
            splitters.forEach((splitterData, index) => {
                const zPos = index * 5;
                const { splitterGroup, portMeshes } = createSplitter(splitterData, zPos);
                allSplitterGroups.push(splitterGroup);
                allSplitterPorts.push(...portMeshes);
            });
        }

        const allFlatFibers = allFibersArrays.flat();
        const allConnectables = [...allFlatFibers, ...allSplitterPorts];

        return {
            allFibers: allFibersArrays,
            allCables,
            allCableGroups,
            allSplitterGroups,
            allConnectables,
        }
    }, [cables, splitters])

    useEffect(() => {
        const initialConnections = localStorage.getItem("connections3D");
        if (initialConnections && allConnectables.length && scene) {
            const parsedConnections: InitialConnectionObject[] = JSON.parse(initialConnections);
            createInitialConnections(parsedConnections, allConnectables, scene);
        }
    }, [allConnectables, scene]);


    // main useEffect for event listeners
    useEffect(() => {
        if (!mountRef.current) return;

        allConnectables.forEach((fiber) => {
            if (!originalMaterials.has(fiber)) {
                originalMaterials.set(fiber, (fiber as THREE.Mesh).material);
            }
        });

        const currentMountRef = mountRef.current;

        const updateAttachedConnections = (transformedGroup: THREE.Object3D) => {
            connections.current.forEach(conn => {
                let isConnected = false;
                let fiber1Parent = conn.fiber1.parent;
                while (fiber1Parent && fiber1Parent !== scene) {
                    if (fiber1Parent === transformedGroup) {
                        isConnected = true;
                        break;
                    }
                    fiber1Parent = fiber1Parent.parent;
                }
                if (!isConnected) {
                    let fiber2Parent = conn.fiber2.parent;
                    while (fiber2Parent && fiber2Parent !== scene) {
                        if (fiber2Parent === transformedGroup) {
                            isConnected = true;
                            break;
                        }
                        fiber2Parent = fiber2Parent.parent;
                    }
                }

                if (isConnected) {
                    conn.update();
                }
            });
        };

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

                isDragging.current = false;
                isDraggingControlPoint.current = true;
                if (controls.current) controls.current.enabled = false;

                const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
                const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, intersectedCPMesh.position);

                const intersectionPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, intersectionPoint);

                const dragOffset = new THREE.Vector3().subVectors(intersectedCPMesh.position, intersectionPoint);

                selectedControlPointInfo.current = {
                    mesh: intersectedCPMesh,
                    connection: connectionInstance as FiberConnection,
                    pointIndex: pointIndex as number,
                    dragPlane: dragPlane,
                    dragOffset: dragOffset
                };
                currentMountRef.style.cursor = 'grabbing';
                return;
            }

            // 2. Check for Cable/Splitter Group Intersection
            const draggableObjects = [...allCableGroups, ...allSplitterGroups];
            const intersects = raycaster.intersectObjects(draggableObjects, true);

            if (intersects.length > 0) {
                let intersectedObject = intersects[0].object;
                let groupToTransform: THREE.Group | null = null;
                let tempObj: THREE.Object3D | null = intersectedObject;
                while (tempObj && tempObj !== scene) {
                    if (draggableObjects.includes(tempObj as THREE.Group)) {
                        groupToTransform = tempObj as THREE.Group;
                        break;
                    }
                    tempObj = tempObj.parent;
                }

                if (groupToTransform && !intersectedObject.userData.isCable && !intersectedObject.userData.isFiber && !intersectedObject.userData.isControlPoint) {
                    controls.current!.enabled = false;
                    selectedCable.current = groupToTransform;

                    // NEW: Check for Alt key to decide between rotating and dragging
                    if (event.altKey) {
                        // START ROTATION
                        isRotating.current = true;
                        isDragging.current = false;
                        rotationInfo.current = {
                            startX: event.clientX,
                            initialRotation: groupToTransform.rotation.clone()
                        };
                        currentMountRef.style.cursor = 'e-resize';

                    } else {
                        // START DRAGGING (TRANSLATION)
                        isDragging.current = true;
                        isRotating.current = false;
                        const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
                        const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, groupToTransform.position);
                        const intersectionPoint = new THREE.Vector3();
                        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
                            const offset = new THREE.Vector3().subVectors(groupToTransform.position, intersectionPoint);
                            dragInfo.current = { plane: dragPlane, offset: offset };
                        } else {
                            dragInfo.current = null;
                        }
                        currentMountRef.style.cursor = 'grabbing';
                    }
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

            // Dragging Control Point logic (unchanged)
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
                return;
            }

            //  Handle rotation on mouse move
            if (isRotating.current && selectedCable.current && rotationInfo.current) {
                const deltaX = event.clientX - rotationInfo.current.startX;
                const rotationSpeed = 0.01; // Sensitivity of rotation

                selectedCable.current.rotation.x = rotationInfo.current.initialRotation.x + (deltaX * rotationSpeed);

                updateAttachedConnections(selectedCable.current);
                return;
            }

            // Handle dragging (translation)
            if (isDragging.current && selectedCable.current && dragInfo.current) {
                const targetPosition = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(dragInfo.current.plane, targetPosition)) {
                    const newPosition = targetPosition.add(dragInfo.current.offset);
                    selectedCable.current.position.copy(newPosition);

                    updateAttachedConnections(selectedCable.current);
                }
                currentMountRef.style.cursor = 'grabbing';
                return;
            }

            // Hover effects logic (unchanged)
            // ... (your existing hover logic remains here) ...
            if (hoveredFiber.current) {
                const originalMaterial = originalMaterials.get(hoveredFiber.current);
                if (originalMaterial) {
                    (hoveredFiber.current as THREE.Mesh).material = originalMaterial;
                }
                if (hoveredFiber.current.userData.originalX !== undefined) {
                    hoveredFiber.current.position.x = hoveredFiber.current.userData.originalX;
                }
                hoveredFiber.current = null;
            }
            const hoverableObjects: THREE.Object3D[] = [
                ...controlPointHelpers.current,
                ...allCableGroups,
                ...allSplitterGroups,
            ];
            const intersects = raycaster.intersectObjects(hoverableObjects, true);
            if (intersects.length > 0) {
                const firstHit = intersects[0].object;
                if (controlPointHelpers.current.includes(firstHit as THREE.Mesh)) {
                    currentMountRef.style.cursor = 'pointer';
                }
                else if (firstHit.userData.isFiber) {
                    hoveredFiber.current = firstHit as THREE.Mesh;
                    if (!originalMaterials.has(hoveredFiber.current)) {
                        originalMaterials.set(hoveredFiber.current, (hoveredFiber.current as THREE.Mesh).material);
                    }
                    if (hoveredFiber.current.userData.originalX === undefined) {
                        hoveredFiber.current.userData.originalX = hoveredFiber.current.position.x;
                    }
                    hoveredFiber.current.position.x = hoveredFiber.current.userData.originalX + (hoveredFiber.current.userData.cableType === 'in' ? 0.05 : -0.05);
                    currentMountRef.style.cursor = 'pointer';
                }
                else {
                    let isCableComponent = false;
                    for (const group of [...allCableGroups, ...allSplitterGroups]) {
                        if (group.getObjectById(firstHit.id)) {
                            isCableComponent = true;
                            break;
                        }
                    }
                    if (isCableComponent) {
                        currentMountRef.style.cursor = 'move';
                    } else {
                        currentMountRef.style.cursor = 'default';
                    }
                }
            } else {
                currentMountRef.style.cursor = 'default';
            }
        };

        const handleMouseUp = () => {
            // Unchanged: End drag for Control Points
            if (isDraggingControlPoint.current) {
                isDraggingControlPoint.current = false;
                if (controls.current) controls.current.enabled = true;
                selectedControlPointInfo.current = null;
            }

            // CHANGED: End drag for Cables/Splitters
            if (isDragging.current) {
                isDragging.current = false;
                if (controls.current) controls.current.enabled = true;
                selectedCable.current = null;
                // ADDED: Clear the drag info
                dragInfo.current = null;
            }

            // NEW: End rotation
            if (isRotating.current) {
                isRotating.current = false;
                if (controls.current) controls.current.enabled = true;
                rotationInfo.current = null;
                selectedCable.current = null;
            }

            // Reset cursor based on current hover state
            if (currentMountRef) {
                raycaster.setFromCamera(mouse, camera);
                const cpIntersects = raycaster.intersectObjects(controlPointHelpers.current);
                const fiberIntersects = raycaster.intersectObjects(allConnectables);

                if (cpIntersects.length > 0) {
                    currentMountRef.style.cursor = 'pointer';
                } else if (fiberIntersects.length > 0 && fiberIntersects[0].object.userData.isFiber) {
                    currentMountRef.style.cursor = 'pointer';
                } else {
                    currentMountRef.style.cursor = 'default';
                }
            }
        };

        const handleClick = (event: MouseEvent) => {
            // ... (Your existing handleClick logic remains unchanged)
            if (!currentMountRef || isDragging.current || isDraggingControlPoint.current) {
                return;
            }
            const rect = currentMountRef.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const cpIntersects = raycaster.intersectObjects(controlPointHelpers.current);
            if (cpIntersects.length > 0) {
                return;
            }

            const connectionTubeMeshes: THREE.Mesh[] = [];
            connections.current.forEach(conn => {
                conn.getMesh().children.forEach(child => {
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
                    if (editingConnection === clickedConnection) {
                        // Optional: Deselect
                    } else {
                        setEditingConnection(clickedConnection);
                        showControlPointHelpers(clickedConnection);
                        setSelectedFibers([]);
                    }
                    return;
                }
            }

            const cableAndFiberIntersects = raycaster.intersectObjects([...allCableGroups, ...allSplitterGroups], true);
            if (cableAndFiberIntersects.length > 0) {
                const firstHitObject = cableAndFiberIntersects[0].object;
                if (firstHitObject.userData.isFiber) {
                    const clickedFiber = firstHitObject as THREE.Mesh;
                    if (editingConnection) {
                        setEditingConnection(null);
                        clearControlPointHelpers();
                    }
                    setSelectedFiber({
                        index: clickedFiber.userData.fiberIndex,
                        cableType: clickedFiber.userData.cableType
                    });

                    const originalMaterial = originalMaterials.get(clickedFiber) || clickedFiber.material;
                    if (selectedFibers.length === 0) {
                        setSelectedFibers([clickedFiber]);
                        (clickedFiber as THREE.Mesh).material = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0x555500 });
                    } else if (selectedFibers.length === 1 && selectedFibers[0] !== clickedFiber) {
                        const fiber1 = selectedFibers[0];
                        const fiber2 = clickedFiber;
                        const firstFiberOriginalMaterial = originalMaterials.get(fiber1) || fiber1.material;
                        (fiber1 as THREE.Mesh).material = firstFiberOriginalMaterial;

                        const newConnection = new FiberConnection(fiber1, fiber2, connectionManager, undefined);
                        scene.add(newConnection.getMesh());
                        connections.current = [...connections.current, newConnection];
                        setSelectedFibers([]);
                    } else if (selectedFibers.length === 1 && selectedFibers[0] === clickedFiber) {
                        (clickedFiber as THREE.Mesh).material = originalMaterial;
                        setSelectedFibers([]);
                    }
                    return;
                } else {
                    if (editingConnection) {
                        setEditingConnection(null);
                        clearControlPointHelpers();
                    }
                    if (selectedFibers.length > 0) {
                        const firstFiberOriginalMaterial = originalMaterials.get(selectedFibers[0]) || selectedFibers[0].material;
                        (selectedFibers[0] as THREE.Mesh).material = firstFiberOriginalMaterial;
                        setSelectedFibers([]);
                    }
                    setSelectedFiber(null);
                    return;
                }
            }

            if (editingConnection) {
                setEditingConnection(null);
                clearControlPointHelpers();
            }
            if (selectedFibers.length > 0) {
                const firstFiberOriginalMaterial = originalMaterials.get(selectedFibers[0]) || selectedFibers[0].material;
                (selectedFibers[0] as THREE.Mesh).material = firstFiberOriginalMaterial;
                setSelectedFibers([]);
            }
            setSelectedFiber(null);
        };

        currentMountRef.addEventListener('mousedown', handleMouseDown);
        currentMountRef.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        currentMountRef.addEventListener('click', handleClick);

        return () => {
            currentMountRef.removeEventListener('mousedown', handleMouseDown);
            currentMountRef.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            currentMountRef.removeEventListener('click', handleClick);
        };

    }, [camera, allCableGroups, allSplitterGroups, allConnectables, editingConnection, selectedFibers, originalMaterials, controls, raycaster, mouse]);

    // ... (rest of your component, including the other useEffect hooks and the return statement)
    useEffect(() => {
        // ... (your existing setup useEffect remains the same)
        connections.current.forEach(conn => scene.add(conn.getMesh()));

        return () => {
            connections.current.forEach(conn => scene.remove(conn.getMesh()));
            clearControlPointHelpers();
        };
    }, [allCables, allFibers, allCableGroups]);

    useEffect(() => {
        if (!mountRef.current) return;
        isMounted.current = true
        renderer.current = new THREE.WebGLRenderer({ antialias: true });
        const rendererInstance = renderer.current;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        rendererInstance.setSize(width, height);
        rendererInstance.setClearColor(0xf0f0f0);
        mountRef.current.appendChild(rendererInstance.domElement);

        camera.aspect = width / height;
        camera.position.set(0.28, 4.36, 2.55);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        controls.current = new OrbitControls(camera, rendererInstance.domElement);
        controls.current.enableDamping = true;
        controls.current.dampingFactor = 0.1;
        controls.current.addEventListener('change', () => {
            const pos = camera.position;
            setCameraPosition(`(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        });

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        scene.add(directionalLight);

        allCableGroups.forEach(cable => scene.add(cable));
        allSplitterGroups.forEach(splitter => scene.add(splitter))
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

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
            sprite.scale.set(0.5, 0.5, 0.5);
            return sprite;
        };

        const xLabel = createTextSprite('X', 'red');
        xLabel.position.set(5.5, 0, 0);
        scene.add(xLabel);
        const yLabel = createTextSprite('Y', 'green');
        yLabel.position.set(0, 5.5, 0);
        scene.add(yLabel);
        const zLabel = createTextSprite('Z', 'blue');
        zLabel.position.set(0, 0, 5.5);
        scene.add(zLabel);

        const animate = () => {
            if (!isMounted.current) return;
            requestAnimationFrame(animate);
            controls.current?.update();
            rendererInstance.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            rendererInstance.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isMounted.current = false;
            window.removeEventListener('resize', handleResize);
            controls.current?.dispose();
            allCableGroups.forEach(cable => scene.remove(cable));
            allSplitterGroups.forEach(splitter => scene.remove(splitter));
            if (mountRef.current && rendererInstance.domElement) {
                mountRef.current.removeChild(rendererInstance.domElement);
            }
            rendererInstance.dispose();
        };
    }, [allCableGroups, allFibers, allSplitterGroups]); // Keep dependencies as they were

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
                    </div>
                )}
            </div>
            {editingConnection && (
                <button
                    onClick={handleDeleteConnection}
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '300px',
                        padding: '8px 15px',
                        backgroundColor: 'rgba(220, 53, 69, 0.8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        zIndex: 10
                    }}
                >
                    Delete Connection
                </button>
            )}
        </div>
    );
};
// The wrapper component OpticalCableVisualizer remains unchanged
const OpticalCableVisualizer: React.FC<{ cables: ICable[], objectsOnCanvas: ISplitter[] }> = ({ cables, objectsOnCanvas }) => {

    return (
        <div>
            <div style={{ margin: '0 auto' }}>
                <OpticalCable cables={cables} objectsOnCanvas={objectsOnCanvas} />
            </div>
        </div>
    );
};

export default OpticalCableVisualizer;