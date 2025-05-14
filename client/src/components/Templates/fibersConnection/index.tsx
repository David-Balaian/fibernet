import { colors } from '@mui/material';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { FiberConnection } from 'src/utils/threeJSHelpers/fiberConnections';
import { getOpticalCableScenes } from 'src/utils/threeJSHelpers/OpticalCableDrawer';
import { ICable, IFiber } from 'src/utils/threeJSHelpers/types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface OpticalCableProps {
    cables: ICable[]
}

const OpticalCable: React.FC<OpticalCableProps> = ({ cables }) => {
    const mountRef = useRef<HTMLDivElement>(null);
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
            } = getOpticalCableScenes(cable.fibers, cable.type, cable.type === "in" ? inCableIndex : outCableIndex)
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


    useEffect(() => {
        if (!mountRef.current) return;

        allFibers.forEach(fibers => {
            fibers.forEach((fiber) => {
                originalMaterials.set(fiber, (fiber as THREE.Mesh).material);
            })
        });

        // function getWorldPositionFromMouse(event: MouseEvent, camera: THREE.Camera, container: HTMLElement) {
        //     const rect = container.getBoundingClientRect();
        //     const mouse = new THREE.Vector2(
        //         ((event.clientX - rect.left) / rect.width) * 2 - 1,
        //         -((event.clientY - rect.top) / rect.height) * 2 + 1
        //     );

        //     const raycaster = new THREE.Raycaster();
        //     raycaster.setFromCamera(mouse, camera);

        //     // Create plane at cable's initial Z position
        //     const planeZ = selectedCable.current?.position.z || 0;
        //     const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
        //     const target = new THREE.Vector3();
        //     raycaster.ray.intersectPlane(plane, target);

        //     return target;
        // }



        const handleMouseDown = (event: MouseEvent) => {
            if (!mountRef.current) return;
            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects([...allCableGroups]);

            if (intersects.length > 0) {
                controls.current!.enabled = false;
                isDragging.current = true;
                const clickedObj = intersects[0].object;
                const cableGroup = clickedObj.parent; // This is our group
                selectedCable.current = cableGroup;
                if (cableGroup) {
                    // Calculate initial intersection point
                    const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -cableGroup.position.z);
                    const target = new THREE.Vector3();
                    raycaster.ray.intersectPlane(xyPlane, target);

                    // Store offset between cable position and intersection point
                    dragOffset.current = new THREE.Vector3().subVectors(cableGroup.position, target);

                    mountRef.current.style.cursor = 'pointer';
                }
            }
        };

        const handleMouseUp = () => {
            if (!mountRef.current) return;
            isDragging.current = (false)
            controls.current!.enabled = true;
            selectedCable.current = (null);
            mountRef.current.style.cursor = 'default';
        }

        const handleMouseMove = (event: MouseEvent) => {
            if (!mountRef.current) return;
            if (isDragging.current && selectedCable.current && dragOffset.current) {
                const rect = mountRef.current.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);

                const target = new THREE.Vector3();
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);

                // Automatic plane selection based on camera view
                const verticalThreshold = 0.7; // Adjust this value to control plane switching sensitivity
                const isTopDownView = Math.abs(cameraDirection.y) > verticalThreshold;

                if (isTopDownView) {
                    // XZ plane movement for top-down views
                    const xzPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -selectedCable.current.position.y);
                    raycaster.ray.intersectPlane(xzPlane, target);
                    selectedCable.current.position.x = target.x + dragOffset.current.x;
                    selectedCable.current.position.z = target.z + dragOffset.current.z;
                } else {
                    // XY plane movement for angled/front views
                    const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -selectedCable.current.position.z);
                    raycaster.ray.intersectPlane(xyPlane, target);
                    selectedCable.current.position.x = target.x + dragOffset.current.x;
                    selectedCable.current.position.y = target.y + dragOffset.current.y;
                }

                // Update connections
                connections.current.forEach(connection => {
                    const fiber1Group = connection['fiber1'].parent;
                    const fiber2Group = connection['fiber2'].parent;
                    if (fiber1Group === selectedCable.current || fiber2Group === selectedCable.current) {
                        connection.update();
                        scene.remove(connection.getMesh());
                        scene.add(connection.getMesh());
                    }
                });
            }

            const rect = mountRef.current.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects([...allCableGroups]);

            if (hoveredFiber.current) {
                (hoveredFiber.current as THREE.Mesh).material = originalMaterials.get(hoveredFiber.current);
                hoveredFiber.current.position.x = hoveredFiber.current.userData.originalX;
                hoveredFiber.current = null;
                mountRef.current.style.cursor = 'default';
            }

            if (intersects.length > 0 && intersects[0].object.userData.isFiber) {
                hoveredFiber.current = intersects[0].object;
                const originalX = hoveredFiber.current.position.x;
                hoveredFiber.current.userData.originalX = originalX;
                hoveredFiber.current.position.x = originalX + (hoveredFiber.current.userData.cableType === 'in' ? 0.1 : -0.1);
                mountRef.current.style.cursor = 'pointer';
            }
        };

        const handleClick = (event: MouseEvent) => {
            if (!mountRef.current) return;

            const rect = mountRef.current!.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects([...allCableGroups]);

            if (intersects.length > 0 && intersects[0].object.userData.isFiber) {
                const clickedFiber = intersects[0].object as THREE.Mesh;;
                setSelectedFiber({
                    index: clickedFiber.userData.fiberIndex,
                    cableType: clickedFiber.userData.cableType
                });
                console.log(clickedFiber.position, "clickedFiber.position");

                // Visual feedback
                const originalMaterial = originalMaterials.get(clickedFiber);
                // (clickedFiber as THREE.Mesh).material = new THREE.MeshPhongMaterial({
                //     color: new THREE.Color(0xff0000),
                //     shininess: 100
                // });

                if (selectedFibers.length === 0) {
                    // First fiber selection
                    setSelectedFibers([clickedFiber]);
                } else if (selectedFibers.length === 1 && selectedFibers[0] !== clickedFiber) {
                    // Second fiber selection - create connection
                    const connection = new FiberConnection(selectedFibers[0], clickedFiber);

                    scene.add(connection.getMesh());
                    connections.current = [...connections.current, connection]
                    // setActiveConnection(connection);
                    setSelectedFibers([]);
                }


                // Reset after delay
                setTimeout(() => {
                    (clickedFiber as THREE.Mesh).material = originalMaterial;
                }, 300);
            } else {
                setSelectedFiber(null);
                setSelectedFibers([]);
            }
        };


        mountRef.current.addEventListener('mousemove', handleMouseMove);
        mountRef.current.addEventListener('mouseup', handleMouseUp);
        mountRef.current.addEventListener('click', handleClick);
        mountRef.current.addEventListener('mousedown', handleMouseDown);

        return () => {
            mountRef.current?.removeEventListener('mousemove', handleMouseMove);
            mountRef.current?.removeEventListener('click', handleClick);
            mountRef.current?.removeEventListener('mousedown', handleMouseDown);
            mountRef.current?.removeEventListener('mouseup', handleMouseUp);

        };
    }, [allInteractiveObjects, selectedFibers]);



    useEffect(() => {
        if (!mountRef.current) return;

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
        </div>
    );
};

const getRandomColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return { color: `rgb(${r}, ${g}, ${b})` };
};













const App: React.FC = () => {
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
            <div style={{ margin: '0 auto' }}>
                <OpticalCable cables={cables} />
            </div>
        </div>
    );
};

export default App;