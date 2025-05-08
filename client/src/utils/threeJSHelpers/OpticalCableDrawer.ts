import * as THREE from 'three';
import { IFiber } from './types';

export const FIBER_RADIUS = 0.05;
export const FIBERS_RADIUS_OFFSET = FIBER_RADIUS * 3;
export const MAIN_CABLE_OFFSET = 0.1;


export const getOpticalCableScenes = (fibers: IFiber[], cableType: "in" | "out", cableIndex: number) => {
    const posX = cableType === "in" ? -2 : 2;

    const getFibersCircleLevel = (index: number) => {
        let sum = 8;
        let tier = 1;
        while (index > sum) {
            tier++;
            sum += (8 * tier);
        }
        return tier;
    };

    const createFiberMesh = (fiber: IFiber, index: number) => {
        const fiberGeometry = new THREE.CylinderGeometry(FIBER_RADIUS, FIBER_RADIUS, 1.2, 32);
        const fiberMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(fiber.color),
            shininess: 0,
        });

        const fiberMesh = new THREE.Mesh(fiberGeometry, fiberMaterial);

        // Add custom properties for identification
        fiberMesh.userData = {
            isFiber: true,
            fiberIndex: index,
            cableType: cableType,
            originalColor: fiber.color
        };

        // Position the fiber
        const circleLevel = getFibersCircleLevel(index);
        const isLastCircle = getFibersCircleLevel(fibers.length - 1) === circleLevel;
        const radius = index === 0 ? 0 : circleLevel * FIBERS_RADIUS_OFFSET;
        const countOfFiberDrown = 8 * (circleLevel * (circleLevel - 1)) / 2 + 1;
        const countOfFibersOnLastCircle = fibers.length - countOfFiberDrown;
        const countOfFibersToDrawOnCurrentCircle = isLastCircle ? countOfFibersOnLastCircle : circleLevel * 8;
        const angle = index === 0 ? 0 : (index / countOfFibersToDrawOnCurrentCircle) * Math.PI * 2;

        fiberMesh.position.x = posX;
        fiberMesh.position.y = Math.sin(angle) * radius;
        fiberMesh.position.z = Math.cos(angle) * radius + cableIndex;
        fiberMesh.rotation.z = Math.PI / 2;

        return fiberMesh;
    };

    // Create main cable
    const createMainCable = () => {
        const mainCableRadius = getFibersCircleLevel(fibers.length - 1) * FIBERS_RADIUS_OFFSET + MAIN_CABLE_OFFSET;
        const cableGeometry = new THREE.CylinderGeometry(mainCableRadius, mainCableRadius, 1, 32);
        const cableMaterial = new THREE.MeshPhongMaterial({
            color: 0x444444,
            shininess: 50,
            transparent: true,
            opacity: 1,
        });

        const cableMesh = new THREE.Mesh(cableGeometry, cableMaterial);
        cableMesh.position.x = posX;
        cableMesh.position.z = cableIndex;
        cableMesh.rotation.z = Math.PI / 2;

        // Add custom properties for identification
        cableMesh.userData = {
            isMainCable: true,
            cableType: cableType
        };

        return cableMesh;
    };

    // Create all meshes
    const mainCableMesh = createMainCable();
    const fiberMeshes = fibers.map((fiber, index) => createFiberMesh(fiber, index));
    const cableGroup = new THREE.Group();
    cableGroup.name = `${cableType}-cable-group`;
    cableGroup.add(mainCableMesh);
    cableGroup.add(...fiberMeshes);

    return {
        cableGroup,
        mainCableScene: mainCableMesh,
        fibersScene: fiberMeshes,
        interactivityObjects: {
            fibers: fiberMeshes,
            mainCable: mainCableMesh
        }
    };
};