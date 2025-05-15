import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, useRef, useState } from 'react'
import { OrbitControls as threeOrbitControls } from 'three/examples/jsm/controls/OrbitControls'

interface IFiber {
    color: string
    isMarked?: boolean
}

interface ICable {
    type: 'in' | 'out'
    fibers: IFiber[]
    position?: [number, number, number]
}


const FIBER_RADIUS = 0.05
const FIBER_HEIGHT = 11
const FIBERS_RADIUS_OFFSET = FIBER_RADIUS * 3
const MAIN_CABLE_OFFSET = 0.1
const CABLE_HEIGHT = 10


const Fiber = ({
    fiber,
    index,
    cableType,
    cableIndex,
    position,
    onClick,
    onPointerOver,
    onPointerOut,
}: {
    fiber: IFiber
    index: number
    cableType: 'in' | 'out'
    cableIndex: number
    position: [number, number, number]
    onClick: (e: ThreeEvent<MouseEvent>) => void
    onPointerOver?: () => void
    onPointerOut?: () => void
}) => {
    const meshRef = useRef<THREE.Mesh>(null)
    const posX = cableType === 'in' ? -7 : 7
    const [isMouseOver, setIsMouseOver] = useState(false)
    const material = useMemo(() => {
        if (fiber.isMarked) {
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')!
            canvas.width = 256
            canvas.height = 256
            context.fillStyle = fiber.color
            context.fillRect(0, 0, canvas.width, canvas.height)
            context.fillStyle = '#000000'
            const stripeCount = 6
            const stripeWidth = canvas.width / (stripeCount * 2)
            for (let i = 0; i < stripeCount; i++) {
                const position = (i / stripeCount) * canvas.width
                context.fillRect(position, 0, stripeWidth, canvas.height)
            }
            const texture = new THREE.CanvasTexture(canvas)
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            texture.repeat.set(1, 5)
            return new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 0,
                color: new THREE.Color(fiber.color),
            })
        }
        return new THREE.MeshPhongMaterial({
            color: new THREE.Color(fiber.color),
            shininess: 0,
        })
    }, [fiber])

    const onMouseOver = (e: PointerEvent) => {
        e.stopPropagation();
        onPointerOver?.()
        setIsMouseOver(true)
    }

    const onMouseOut = (e: PointerEvent) => {
        e.stopPropagation();
        onPointerOut?.()
        setIsMouseOver(false)
    }

    return (
        <mesh
            ref={meshRef}
            position={[isMouseOver ? cableType === 'in' ? 0.1 : -0.1 : 0, position[1], position[2]]}
            rotation={[0, 0, Math.PI / 2]}
            onClick={onClick}
            onPointerOver={onMouseOver}
            onPointerOut={onMouseOut}
            userData={{
                isFiber: true,
                fiberIndex: index,
                cableType,
                originalColor: fiber.color,
                isMarked: fiber.isMarked,
            }}
        >
            <cylinderGeometry args={[FIBER_RADIUS, FIBER_RADIUS, FIBER_HEIGHT, 32]} />
            <primitive object={material} attach="material" />
        </mesh>
    )
}


const Cable = ({ cable, index, handleFiberClick }: { cable: ICable; index: number, handleFiberClick: (e: ThreeEvent<MouseEvent>) => void }) => {
    const groupRef = useRef<THREE.Group>(null)
    const isMouseDown = useRef(false)
    const [position, setPosition] = useState<[number, number, number]>([cable.type === 'in' ? -7 : 7, 0, index])
    const isDragging = useRef(false)
    const dragOffset = useRef(new THREE.Vector3())
    const controls = useThree((state) => state.controls) as threeOrbitControls
    const isHovered = useRef(false)

    const posX = cable.type === 'in' ? -7 : 7

    const getCircleLevel = (length: number) => {
        let sum = 8
        let tier = 1
        while (length > sum) {
            tier++
            sum += 8 * tier
        }
        return tier
    }
    const mainCableRadius = useMemo(() => {
        return getCircleLevel(cable.fibers.length - 1) * FIBERS_RADIUS_OFFSET + MAIN_CABLE_OFFSET
    }, [cable.fibers.length])

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        const worldPos = new THREE.Vector3(...position)
        dragOffset.current = worldPos.sub(e.point)
        isDragging.current = true
    }

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        console.log(isDragging.current);
        e.stopPropagation()
        if (isDragging.current) {
            const newPos = e.point.clone().add(dragOffset.current)
            setPosition([newPos.x, newPos.y, position[2]])
            controls!.enabled = false
        }

    }

    const handlePointerUp = () => {
        if (isHovered.current) {
            // isDragging.current = false
            // controls!.enabled = true
        }
    }

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        isHovered.current = true
    }
    const handlePointerOut = () => {
        if (!isDragging.current) {
            isHovered.current = false
        }
    }

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
    }





    return (
        <group
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            ref={groupRef}
            position={position}
            userData={{ cableType: cable.type, cableIndex: index }}
        >
            {/* Main Cable */}
            <mesh position={[0, 0, index]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[mainCableRadius, mainCableRadius, CABLE_HEIGHT, 32]} />
                <meshPhongMaterial color="#6f6f6f" shininess={50} />
            </mesh>

            {/* Fibers */}
            {cable.fibers.map((fiber, i) => {
                const circleLevel = getCircleLevel(i)
                const isLastCircle = getCircleLevel(cable.fibers.length - 1) === circleLevel
                const radius = i === 0 ? 0 : circleLevel * FIBERS_RADIUS_OFFSET
                const countOfFiberDrown = (8 * circleLevel * (circleLevel - 1)) / 2 + 1
                const countOfFibersOnLastCircle = cable.fibers.length - countOfFiberDrown
                const countOfFibersToDraw = isLastCircle ? countOfFibersOnLastCircle : circleLevel * 8
                const angle = i === 0 ? 0 : (i / countOfFibersToDraw) * Math.PI * 2

                return (
                    <Fiber
                        key={i}
                        fiber={fiber}
                        index={i}
                        cableType={cable.type}
                        cableIndex={index}
                        position={[0, Math.sin(angle) * radius, Math.cos(angle) * radius + index]}
                        onClick={handleFiberClick}
                    />
                )
            })}
        </group>
    )
}


const Connection = ({ start, end }: { start: THREE.Mesh; end: THREE.Mesh }) => {

    const groupRef = useRef<THREE.Group>(null)
    console.log(start, end);

    const createStripedMaterial = (baseColor: THREE.Color): THREE.MeshPhongMaterial => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 256;
        canvas.height = 256;

        // Base color
        context.fillStyle = `#${baseColor.getHexString()}`;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add horizontal black stripes
        context.fillStyle = '#000000';
        const stripeCount = 6;
        const stripeHeight = canvas.width / (stripeCount * 2);
        const spacing = canvas.height / (stripeCount + 1);

        for (let i = 0; i < stripeCount; i++) {
            const position = spacing * (i + 1) - stripeHeight / 2;
            context.fillRect(0, position, canvas.width, stripeHeight);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(5, 1); // Adjust horizontal repeat for better wrapping

        return new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 0,
            side: THREE.DoubleSide,
            color: baseColor,
        });
    }

    const curve = useMemo(() => {
        const group = new THREE.Group();
        const startPoint = new THREE.Vector3();
        const endPoint = new THREE.Vector3();
        start.getWorldPosition(startPoint);
        end.getWorldPosition(endPoint);

        startPoint.x += start.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;
        endPoint.x += end.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;

        const midPoint1 = new THREE.Vector3(
            (startPoint.x + endPoint.x) / 2,
            (startPoint.y + endPoint.y) / 2,
            (startPoint.z + endPoint.z) / 2
        );
        const midPoint2 = new THREE.Vector3(
            (startPoint.x + endPoint.x) / 2,
            (startPoint.y + endPoint.y) / 2,
            (startPoint.z + endPoint.z) / 2
        );

        const midStartPoint = startPoint.clone().add(
            new THREE.Vector3(start.userData.cableType === 'in' ? 0.5 : -0.5, 0, 0)
        );
        const midEndPoint = endPoint.clone().add(
            new THREE.Vector3(end.userData.cableType === 'in' ? 0.5 : -0.5, 0, 0)
        );

        const points = [
            startPoint,
            midStartPoint,
            midPoint1,
            midPoint2,
            midEndPoint,
            endPoint
        ];
        const curve = new THREE.CatmullRomCurve3(points);

        const fiber1Color = new THREE.Color(start.userData.originalColor);
        const material1 = start.userData.isMarked
            ? createStripedMaterial(fiber1Color)
            : new THREE.MeshPhongMaterial({
                color: fiber1Color,
                side: THREE.DoubleSide
            });

        const fiber2Color = new THREE.Color(end.userData.originalColor);
        const material2 = end.userData.isMarked
            ? createStripedMaterial(fiber2Color)
            : new THREE.MeshPhongMaterial({
                color: fiber2Color,
                side: THREE.DoubleSide
            });

        const points1 = curve.getPoints(50).slice(0, 26);
        let geometry1 = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points1),
            20,
            0.05,
            8,
            false
        );

        geometry1 = new THREE.TubeGeometry(
            geometry1.parameters.path,
            geometry1.parameters.tubularSegments,
            geometry1.parameters.radius,
            geometry1.parameters.radialSegments,
            geometry1.parameters.closed
        );

        const tube1 = new THREE.Mesh(geometry1, material1);
        group.add(tube1);

        const points2 = curve.getPoints(50).slice(25);
        let geometry2 = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points2),
            20,
            0.05,
            8,
            false
        );

        geometry2 = new THREE.TubeGeometry(
            geometry2.parameters.path,
            geometry2.parameters.tubularSegments,
            geometry2.parameters.radius,
            geometry2.parameters.radialSegments,
            geometry2.parameters.closed
        );

        const tube2 = new THREE.Mesh(geometry2, material2);
        group.add(tube2);

        return { tube1, tube2 };
    }, [start, end])

    return (
        <group ref={groupRef}>
            <primitive object={curve.tube1} />
            <primitive object={curve.tube2} />
        </group>
    )
}


const Scene = ({ cables }: { cables: ICable[] }) => {
    const [connections, setConnections] = useState<[THREE.Mesh, THREE.Mesh][]>([])
    const selectedFiber = useRef<THREE.Mesh | null>(null)
    const controls = useRef(null)

    const handleFiberClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (selectedFiber.current) {
            setConnections((prev) => [...prev, [e.object as THREE.Mesh, selectedFiber.current as THREE.Mesh]])
            selectedFiber.current = null
        } else {
            selectedFiber.current = (e.object as THREE.Mesh)
        }
    }



    return (
        <>
            <OrbitControls makeDefault ref={controls} enableDamping dampingFactor={1} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 10, 10]} intensity={0.8} />

            {cables.map((cable, i) => (
                <Cable key={`${cable.type}-${i}`} cable={cable} index={i} handleFiberClick={handleFiberClick} />
            ))}

            {connections.map(([start, end], i) => (
                <Connection key={i} start={start} end={end} />
            ))}

            <axesHelper />
            <Text position={[5.5, 0, 0]} color="red">
                X
            </Text>
            <Text position={[0, 5.5, 0]} color="green">
                Y
            </Text>
            <Text position={[0, 0, 5.5]} color="blue">
                Z
            </Text>
        </>
    )
}




const App = () => {
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
            <div style={{ margin: '0 auto', width: '100vw', height: '100vh' }}>

                <Canvas camera={{ position: [0.28, 4.36, 2.55] }}>
                    <Scene cables={cables} />
                </Canvas>
            </div>
        </div>
    )
}

export default App