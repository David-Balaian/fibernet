// src/utils/threeJSHelpers/SplitterDrawer.ts

import * as THREE from 'three';
import { ISplitter } from './types';

// Define constants for splitter dimensions for easy tweaking
const SPLITTER_WIDTH = 0.1;
const SPLITTER_HEIGHT = 2;
const SPLITTER_DEPTH = 0.3;
const PORT_RADIUS = 0.05;
const PORT_LENGTH = 0.2;
const PORT_SPACING = 0.25;

/**
 * Creates a text sprite for labeling the splitter.
 */
const createNameSprite = (text: string): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 128;
    context.font = 'bold 40px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 0.75, 1.0);
    return sprite;
};

/**
 * Generates a THREE.Group representing a single splitter with its ports.
 * @param splitterData The data object for the splitter.
 * @param zPosition The position on the Z-axis to draw this splitter.
 * @returns An object containing the main group and an array of all its port meshes.
 */
export const createSplitter = (splitterData: ISplitter, zPosition: number) => {
    const splitterGroup = new THREE.Group();
    splitterGroup.position.set(0, SPLITTER_HEIGHT / 2, zPosition);
    
    // Add userData to the group for easy identification during drag operations
    splitterGroup.userData = {
        isSplitter: true,
        id: splitterData.id,
    };

    // 1. Create the main box
    const boxGeometry = new THREE.BoxGeometry(SPLITTER_WIDTH, SPLITTER_HEIGHT, SPLITTER_DEPTH);
    const boxMaterial = new THREE.MeshStandardMaterial({
        color: 0x333344,
        metalness: 0.8,
        roughness: 0.4,
    });
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    boxMesh.userData = { isSplitterBody: true }; // Identify body for dragging
    splitterGroup.add(boxMesh);

    // 2. Create the name label
    const nameLabel = createNameSprite(splitterData.name);
    nameLabel.position.set(0, SPLITTER_HEIGHT / 2 + 0.5, 0); // Position above the box
    splitterGroup.add(nameLabel);

    const allPortMeshes: THREE.Mesh[] = [];

    // 3. Create Input Ports (on the left, -X side)
    const totalInputHeight = splitterData.inputs.length * PORT_SPACING;
    splitterData.inputs.forEach((port, index) => {
        const portGeometry = new THREE.CylinderGeometry(PORT_RADIUS, PORT_RADIUS, PORT_LENGTH, 16);
        const portMaterial = new THREE.MeshPhongMaterial({ color: port.color || 0xffffff });
        const portMesh = new THREE.Mesh(portGeometry, portMaterial);

        // Position the port on the left face of the box
        portMesh.position.x = -SPLITTER_WIDTH / 2 - PORT_LENGTH / 2;
        portMesh.position.y = (totalInputHeight / 2) - (index * PORT_SPACING) - (PORT_SPACING / 2);
        portMesh.rotation.z = Math.PI / 2;

        // CRITICAL: Set userData to mimic a fiber so connection logic works seamlessly
        portMesh.userData = {
            isFiber: true,
            fiberIndex: index,
            // An input port "outputs" a connection towards the right, so its type is 'out'
            cableType: 'out',
            originalColor: port.color || '#ffffff',
            isMarked: false,
            cableId: splitterData.id,
            fiberId: port.id,
            isSplitterPort: true,
        };
        
        splitterGroup.add(portMesh);
        allPortMeshes.push(portMesh);
    });

    // 4. Create Output Ports (on the right, +X side)
    const totalOutputHeight = splitterData.outputs.length * PORT_SPACING;
    splitterData.outputs.forEach((port, index) => {
        const portGeometry = new THREE.CylinderGeometry(PORT_RADIUS, PORT_RADIUS, PORT_LENGTH, 16);
        const portMaterial = new THREE.MeshPhongMaterial({ color: port.color || 0xffffff });
        const portMesh = new THREE.Mesh(portGeometry, portMaterial);

        portMesh.position.x = SPLITTER_WIDTH / 2 + PORT_LENGTH / 2;
        portMesh.position.y = (totalOutputHeight / 2) - (index * PORT_SPACING) - (PORT_SPACING / 2);
        portMesh.rotation.z = Math.PI / 2;

        portMesh.userData = {
            isFiber: true,
            fiberIndex: index,
            // An output port "inputs" a connection from the left, so its type is 'in'
            cableType: 'in',
            originalColor: port.color || '#ffffff',
            isMarked: false,
            cableId: splitterData.id,
            fiberId: port.id,
            isSplitterPort: true,
        };
        
        splitterGroup.add(portMesh);
        allPortMeshes.push(portMesh);
    });

    return {
        splitterGroup,
        portMeshes: allPortMeshes,
    };
};