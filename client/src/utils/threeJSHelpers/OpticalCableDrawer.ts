import * as THREE from 'three';
import { IFiber, ITube } from './types'; // Make sure ITube is imported

// Replace this block at the top of the file

export const FIBER_RADIUS = 0.05;
// The "height" of the cylinder is its length in this orientation.
// Fiber is now the longest component.
export const FIBER_HEIGHT = 11;
export const FIBERS_RADIUS_OFFSET = FIBER_RADIUS * 3;
export const MAIN_CABLE_OFFSET = 0.1;
export const TUBE_OFFSET = 0.06;

// ADDED: Specific lengths for tubes and the main sheath
const TUBE_LENGTH = 10.5;
const CABLE_SHEATH_LENGTH = 10; // Renamed from CABLE_HEIGHT for clarity

const TUBE_VISUAL_RADIUS = 0.4;
const TUBE_SPACING = 0.1;

// The overall function signature is changed to accept tubes
export const getOpticalCableScenes = (fibers: IFiber[], cableType: "in" | "out", cableIndex: number, cableId: string, tubes?: ITube[]) => {
    const posX = cableType === "in" ? -7 : 7;
    const cableGroup = new THREE.Group();
    cableGroup.name = `${cableType}-cable-group-${cableId}`;

    const getFibersCircleLevel = (index: number): number => {
        if (index < 0) return 0;
        let sum = 8;
        let tier = 1;
        while (index >= sum) {
            tier++;
            sum += (8 * tier);
        }
        return tier;
    };

    const createFiberMaterial = (fiber: IFiber): THREE.MeshPhongMaterial => {
        // ... (This function is unchanged from your original code)
        if (fiber.isMarked) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 256; canvas.height = 256;
            context.fillStyle = fiber.color;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#000000';
            const stripeCount = 6;
            const stripeWidth = canvas.width / (stripeCount * 2);
            for (let i = 0; i < stripeCount; i++) {
                const position = (i / stripeCount) * canvas.width;
                context.fillRect(position, 0, stripeWidth, canvas.height);
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 5);
            return new THREE.MeshPhongMaterial({ map: texture, shininess: 0, color: new THREE.Color(fiber.color) });
        }
        return new THREE.MeshPhongMaterial({ color: new THREE.Color(fiber.color), shininess: 0 });
    };

    const fibersByTube: { [key: string]: IFiber[] } = {};
    const looseFibers: IFiber[] = [];
    const tubesById = new Map(tubes?.map(t => [t.id, t]));

    fibers.forEach(fiber => {
        if (fiber.tubeId && tubesById.has(fiber.tubeId)) {
            if (!fibersByTube[fiber.tubeId]) fibersByTube[fiber.tubeId] = [];
            fibersByTube[fiber.tubeId].push(fiber);
        } else {
            looseFibers.push(fiber);
        }
    });

    const allDrawnFiberMeshes: THREE.Mesh[] = [];
    let tubeLayoutData: { tube: ITube, dynamicRadius: number, fibers: IFiber[], pos: THREE.Vector2 }[] = [];
    // --- NEW GEOMETRIC TUBE PLACEMENT LOGIC ---
    if (tubes) {
        // 1. Calculate dynamic radii for all tubes that contain fibers
        tubeLayoutData = tubes.map(tube => {
            const tubeFibers = fibersByTube[tube.id] || [];
            if (tubeFibers.length === 0) return null;
            const dynamicRadius = getFibersCircleLevel(tubeFibers.length - 1) * FIBERS_RADIUS_OFFSET + MAIN_CABLE_OFFSET;
            return { tube, dynamicRadius, fibers: tubeFibers, pos: new THREE.Vector2() };
        }).filter(t => t !== null) as { tube: ITube, dynamicRadius: number, fibers: IFiber[], pos: THREE.Vector2 }[];

        // Sort by radius descending to place largest tubes first
        tubeLayoutData.sort((a, b) => b.dynamicRadius - a.dynamicRadius);

        // 2. Place tubes sequentially
        if (tubeLayoutData.length > 0) {
            // Place first tube at origin
            tubeLayoutData[0].pos.set(0, 0);

            if (tubeLayoutData.length > 1) {
                // Place second tube next to the first
                const r0 = tubeLayoutData[0].dynamicRadius;
                const r1 = tubeLayoutData[1].dynamicRadius;
                tubeLayoutData[1].pos.set(r0 + r1 + TUBE_SPACING, 0);
            }

            for (let i = 2; i < tubeLayoutData.length; i++) {
                // Place subsequent tubes tangent to the previous two
                const p0 = tubeLayoutData[i - 2].pos;
                const r0 = tubeLayoutData[i - 2].dynamicRadius + tubeLayoutData[i].dynamicRadius + TUBE_SPACING;

                const p1 = tubeLayoutData[i - 1].pos;
                const r1 = tubeLayoutData[i - 1].dynamicRadius + tubeLayoutData[i].dynamicRadius + TUBE_SPACING;

                const d = p0.distanceTo(p1);

                // Check if solution exists
                if (d > r0 + r1 || d < Math.abs(r0 - r1)) {
                    // This case happens if a tube is too small to touch the previous two.
                    // We can place it tangent to the larger of the previous two.
                    const prevTube = tubeLayoutData[i - 1];
                    const angle = prevTube.pos.angle() + Math.PI / 3; // Arbitrary angle shift
                    const dist = prevTube.dynamicRadius + tubeLayoutData[i].dynamicRadius + TUBE_SPACING;
                    tubeLayoutData[i].pos.set(prevTube.pos.x + Math.cos(angle) * dist, prevTube.pos.y + Math.sin(angle) * dist);
                    continue;
                }

                const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
                const h = Math.sqrt(r0 * r0 - a * a);

                const p2_x = p0.x + a * (p1.x - p0.x) / d;
                const p2_y = p0.y + a * (p1.y - p0.y) / d;

                // There are two possible points, we choose one consistently
                const pt1_x = p2_x + h * (p1.y - p0.y) / d;
                const pt1_y = p2_y - h * (p1.x - p0.x) / d;

                tubeLayoutData[i].pos.set(pt1_x, pt1_y);
            }
        }

        // 3. Center the entire cluster of tubes
        const centroid = new THREE.Vector2();
        tubeLayoutData.forEach(data => centroid.add(data.pos));
        centroid.divideScalar(tubeLayoutData.length);
        tubeLayoutData.forEach(data => data.pos.sub(centroid));

        // 4. Draw the tubes and their inner fibers
        tubeLayoutData.forEach(data => {
            const { tube, dynamicRadius, fibers, pos } = data;
            const tubeGeom = new THREE.CylinderGeometry(dynamicRadius, dynamicRadius, TUBE_LENGTH, 32);
            const tubeMat = new THREE.MeshPhongMaterial({ color: tube.color, shininess: 20 });
            const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
            tubeMesh.position.set(posX, pos.x, pos.y + cableIndex);
            tubeMesh.rotation.z = Math.PI / 2;
            cableGroup.add(tubeMesh);

            fibers.forEach((fiber, fiberIdx) => {
                const fiberGeometry = new THREE.CylinderGeometry(FIBER_RADIUS, FIBER_RADIUS, FIBER_HEIGHT, 32);
                const fiberMaterial = createFiberMaterial(fiber);
                const fiberMesh = new THREE.Mesh(fiberGeometry, fiberMaterial);
                fiberMesh.userData = { isFiber: true, fiberIndex: fiberIdx, cableType, originalColor: fiber.color, isMarked: fiber.isMarked, cableId: fiber.parentId, fiberId: fiber.id };

                const circleLevel = getFibersCircleLevel(fiberIdx);
                const radius = fiberIdx === 0 ? 0 : circleLevel * FIBERS_RADIUS_OFFSET;
                const countOfFiberDrown = circleLevel > 1 ? 8 * (circleLevel * (circleLevel - 1)) / 2 : 0;
                const countOnThisLevel = fiberIdx - countOfFiberDrown;
                const fibersOnThisCircle = circleLevel * 8;
                const fiberAngle = (countOnThisLevel / fibersOnThisCircle) * Math.PI * 2;

                fiberMesh.position.set(
                    posX,
                    pos.x + Math.sin(fiberAngle) * radius,
                    pos.y + cableIndex + Math.cos(fiberAngle) * radius
                );
                fiberMesh.rotation.z = Math.PI / 2;
                cableGroup.add(fiberMesh);
                allDrawnFiberMeshes.push(fiberMesh);
            });
        });
    }

    // --- DRAW LOOSE FIBERS --- (This should now be empty if all fibers are in tubes)
    looseFibers.forEach((fiber, index) => {
        // ... (This logic remains unchanged, as a fallback) ...
        const fiberGeometry = new THREE.CylinderGeometry(FIBER_RADIUS, FIBER_RADIUS, FIBER_HEIGHT, 32);
        const fiberMaterial = createFiberMaterial(fiber);
        const fiberMesh = new THREE.Mesh(fiberGeometry, fiberMaterial);

        fiberMesh.userData = { isFiber: true, fiberIndex: index, cableType, originalColor: fiber.color, isMarked: fiber.isMarked, cableId: fiber.parentId, fiberId: fiber.id };

        const circleLevel = getFibersCircleLevel(index);
        const radius = index === 0 ? 0 : circleLevel * FIBERS_RADIUS_OFFSET;
        const countOfFiberDrown = circleLevel > 1 ? 8 * (circleLevel * (circleLevel - 1)) / 2 : 0;
        const countOnThisLevel = index - countOfFiberDrown;
        const fibersOnThisCircle = circleLevel * 8;
        const angle = (countOnThisLevel / fibersOnThisCircle) * Math.PI * 2;

        fiberMesh.position.set(posX, Math.sin(angle) * radius, Math.cos(angle) * radius + cableIndex);
        fiberMesh.rotation.z = Math.PI / 2;
        cableGroup.add(fiberMesh);
        allDrawnFiberMeshes.push(fiberMesh);
    });

    // --- Create main cable sheath ---
    const mainCableRadius = allDrawnFiberMeshes.reduce((maxR, mesh) => {
        const tubeData = (tubeLayoutData || []).find(d => d.fibers.some(f => f.id === mesh.userData.fiberId));
        const fiberR = new THREE.Vector2(mesh.position.y, mesh.position.z - cableIndex).length();
        return Math.max(maxR, fiberR + (tubeData ? tubeData.dynamicRadius - new THREE.Vector2(mesh.position.y - tubeData.pos.x, mesh.position.z - (tubeData.pos.y + cableIndex)).length() : 0));
    }, 0) + MAIN_CABLE_OFFSET;

    const cableGeometry = new THREE.CylinderGeometry(mainCableRadius, mainCableRadius, CABLE_SHEATH_LENGTH, 64);
    const cableMaterial = new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 50, transparent: true, opacity: 1.0 });
    const mainCableMesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mainCableMesh.position.set(posX, 0, cableIndex);
    mainCableMesh.rotation.z = Math.PI / 2;
    mainCableMesh.userData = { isMainCable: true, cableType, id: cableId };

    cableGroup.add(mainCableMesh);
    // Put sheath behind other objects
    mainCableMesh.renderOrder = -1;

    return {
        cableGroup,
        mainCableScene: mainCableMesh,
        fibersScene: allDrawnFiberMeshes,
        interactivityObjects: { fibers: allDrawnFiberMeshes, mainCable: mainCableMesh }
    };
};








