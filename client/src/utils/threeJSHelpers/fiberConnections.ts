// src/utils/threeJSHelpers/fiberConnections.ts
import * as THREE from 'three';
import { FIBER_HEIGHT } from './OpticalCableDrawer';
import { ConnectionManager } from './ConnectionManager';
export type ControlPointData = { x: number; y: number; z: number };

export type InitialConnectionObject = {
  points: ControlPointData[];
  fiber1Id: string;
  fiber2Id: string;
  fiber1CableType?: string;
  fiber2CableType?: string;
  fiber1CableId?: string;
  fiber2CableId?: string;
}


export class FiberConnection {
  public fiber1: THREE.Mesh;
  public fiber2: THREE.Mesh;
  private mesh: THREE.Group;
  private controlPointsForConstructor?: ControlPointData[]

  private controlPoints: THREE.Vector3[];
  private slotIndex: number | undefined;
  private connectionManager: ConnectionManager;

  constructor(fiber1: THREE.Mesh, fiber2: THREE.Mesh, connectionManager: ConnectionManager, controlPointsForConstructor?: ControlPointData[]) {
    this.fiber1 = fiber1;
    this.fiber2 = fiber2;
    this.controlPointsForConstructor = controlPointsForConstructor
    this.connectionManager = connectionManager;

    this.mesh = new THREE.Group();
    this.mesh.userData = { isConnection: true, connectionInstance: this };

    if (controlPointsForConstructor && controlPointsForConstructor.length > 0) {
      console.log("Creating connection from saved points.");
      this.controlPoints = controlPointsForConstructor.map(p => new THREE.Vector3(p.x, p.y, p.z));
      this.slotIndex = -1;
    } else {
      console.log("Creating new connection with slotting.");
      this.slotIndex = this.connectionManager.acquireSlot();
      this.controlPoints = this.calculateInitialControlPoints();
    }

    this.rebuildConnectionMesh();
  }

  // ADDED: A helper function to get the correct anchor point for either a fiber or a splitter port.
  private getAnchorPoint(fiberMesh: THREE.Mesh): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    fiberMesh.getWorldPosition(worldPos);

    if (fiberMesh.userData.isSplitterPort) {
        // CASE 1: It's a splitter port. The offset is based on its own geometry's length.
        // The port cylinder is rotated, so its "height" corresponds to its length along the X-axis.
        const portLength = (fiberMesh.geometry as THREE.CylinderGeometry).parameters.height;
        // The cableType determines which way the connection should extend from the port.
        worldPos.x += fiberMesh.userData.cableType === 'in' ? portLength / 2 : -portLength / 2;
    } else {
        // CASE 2: It's a regular fiber. Use the existing logic with the imported constant.
        worldPos.x += fiberMesh.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;
    }
    return worldPos;
  }

  private calculateInitialControlPoints(): THREE.Vector3[] {
    // CHANGED: Use the new getAnchorPoint helper for consistency.
    const tubeAnchorStart = this.getAnchorPoint(this.fiber1);
    const tubeAnchorEnd = this.getAnchorPoint(this.fiber2);

    const yLevel = this.connectionManager.getOffsetY(this.slotIndex || 0);

    const midStartPoint = tubeAnchorStart.clone().add(
      new THREE.Vector3(this.fiber1.userData.cableType === 'in' ? 1.5 : -1.5, 0, 0)
    );
    midStartPoint.y = yLevel;

    const midEndPoint = tubeAnchorEnd.clone().add(
      new THREE.Vector3(this.fiber2.userData.cableType === 'in' ? 1.5 : -1.5, 0, 0)
    );
    midEndPoint.y = yLevel;

    const midPoint1 = new THREE.Vector3(
      (tubeAnchorStart.x + tubeAnchorEnd.x) / 2,
      yLevel,
      tubeAnchorStart.z
    );
    const midPoint2 = new THREE.Vector3(
      (tubeAnchorStart.x + tubeAnchorEnd.x) / 2,
      yLevel,
      tubeAnchorEnd.z
    );

    return [midStartPoint, midPoint1, midPoint2, midEndPoint];
  }

  private createStripedMaterial(baseColor: THREE.Color): THREE.MeshPhongMaterial {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 256;
    context.fillStyle = `#${baseColor.getHexString()}`;
    context.fillRect(0, 0, canvas.width, canvas.height);
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
    texture.repeat.set(5, 1);
    return new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 0,
        side: THREE.DoubleSide,
        color: baseColor,
    });
  }

  private rebuildConnectionMesh(): void {
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0] as THREE.Mesh;
      this.mesh.remove(child);
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // CHANGED: Use the new helper function to get the correct start/end points.
    const tubeActualStartPoint = this.getAnchorPoint(this.fiber1);
    const tubeActualEndPoint = this.getAnchorPoint(this.fiber2);

    const curveDefiningPoints = [
      tubeActualStartPoint,
      ...this.controlPoints,
      tubeActualEndPoint
    ];

    if (curveDefiningPoints.length < 2) {
      console.warn("FiberConnection: Not enough points to create a curve.");
      return;
    }
    const curve = new THREE.CatmullRomCurve3(curveDefiningPoints);

    const fiber1Color = new THREE.Color(this.fiber1.userData.originalColor);
    const material1 = this.fiber1.userData.isMarked
      ? this.createStripedMaterial(fiber1Color)
      : new THREE.MeshPhongMaterial({ color: fiber1Color, side: THREE.DoubleSide });

    const fiber2Color = new THREE.Color(this.fiber2.userData.originalColor);
    const material2 = this.fiber2.userData.isMarked
      ? this.createStripedMaterial(fiber2Color)
      : new THREE.MeshPhongMaterial({ color: fiber2Color, side: THREE.DoubleSide });

    const allCurvePoints = curve.getPoints(50);
    if (allCurvePoints.length < 2) return;

    const midIndex = Math.floor(allCurvePoints.length / 2);

    const points1 = allCurvePoints.slice(0, midIndex + 1);
    if (points1.length >= 2) {
      const geometry1 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points1), 20, 0.05, 8, false);
      const tube1 = new THREE.Mesh(geometry1, material1);
      this.mesh.add(tube1);
    }

    const points2 = allCurvePoints.slice(midIndex);
    if (points2.length >= 2) {
      const geometry2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points2), 20, 0.05, 8, false);
      const tube2 = new THREE.Mesh(geometry2, material2);
      this.mesh.add(tube2);
    }
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public update(): void {
    this.rebuildConnectionMesh();
  }
  
  public getPotentialEditablePointsWorldPositions(): THREE.Vector3[] {
    return this.controlPoints.map(p => p.clone());
  }

  public setControlPointWorld(index: number, position: THREE.Vector3): void {
    if (index >= 0 && index < this.controlPoints.length) {
      if (this.slotIndex !== undefined && this.slotIndex >= 0) {
        console.log(`Connection releasing slot ${this.slotIndex} due to manual modification.`);
        this.connectionManager.releaseSlot(this.slotIndex);
        this.slotIndex = -1;
      }

      if (position && position instanceof THREE.Vector3) {
        this.controlPoints[index].copy(position);
        this.update();
      } else {
        console.error("Invalid position provided to setControlPointWorld.", position);
      }
    } else {
      console.warn(`Control point index ${index} is out of bounds.`);
    }
  }

  public dispose(): void {
    console.log('[FiberConnection] Disposing connection:', this);
    if (this.slotIndex !== undefined && this.slotIndex >= 0) {
      console.log(`Connection disposed, releasing slot ${this.slotIndex}.`);
      this.connectionManager.releaseSlot(this.slotIndex);
    }
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0] as THREE.Mesh;
      this.mesh.remove(child);
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  public getControlPointsData(): ControlPointData[] {
    return this.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));
  }
}