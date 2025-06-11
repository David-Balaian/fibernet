// src/utils/threeJSHelpers/fiberConnections.ts
import * as THREE from 'three';
import { FIBER_HEIGHT } from './OpticalCableDrawer'; // Your existing import
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

  // Store the 4 intermediate control points as class members
  private controlPoints: THREE.Vector3[];
  private slotIndex: number | undefined;
  private connectionManager: ConnectionManager;



  constructor(fiber1: THREE.Mesh, fiber2: THREE.Mesh, connectionManager: ConnectionManager, controlPointsForConstructor?: ControlPointData[]) {
    this.fiber1 = fiber1;
    this.fiber2 = fiber2;
    this.controlPointsForConstructor = controlPointsForConstructor
    this.connectionManager = connectionManager;

    // Initialize control points based on initial fiber positions
    this.controlPoints = this.calculateInitialControlPoints();

    this.mesh = new THREE.Group(); // Create the main group first
    this.mesh.userData = { isConnection: true, connectionInstance: this };
    if (controlPointsForConstructor && controlPointsForConstructor.length > 0) {
      // CASE 1: This connection has saved points. Use them directly.
      console.log("Creating connection from saved points.");
      this.controlPoints = controlPointsForConstructor.map(p => new THREE.Vector3(p.x, p.y, p.z));
      this.slotIndex = -1; // Mark as manually placed (unmanaged)
    } else {
      // CASE 2: This is a brand new connection. Acquire a slot.
      console.log("Creating new connection with slotting.");
      this.slotIndex = this.connectionManager.acquireSlot();
      this.controlPoints = this.calculateInitialControlPoints();
    }


    this.rebuildConnectionMesh(); // Call a method that populates this.mesh
  }

  private calculateInitialControlPoints(): THREE.Vector3[] {

    const fiber1WorldPos = new THREE.Vector3();
    this.fiber1.getWorldPosition(fiber1WorldPos);
    const fiber2WorldPos = new THREE.Vector3();
    this.fiber2.getWorldPosition(fiber2WorldPos);

    // Determine the Y-level for this connection's path from the manager
    const yLevel = this.connectionManager.getOffsetY(this.slotIndex || 0);

    const tubeAnchorStart = fiber1WorldPos.clone();
    tubeAnchorStart.x += this.fiber1.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;

    const tubeAnchorEnd = fiber2WorldPos.clone();
    tubeAnchorEnd.x += this.fiber2.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;

    // The first control point, lifted immediately to the connection's Y-level
    const midStartPoint = tubeAnchorStart.clone().add(
      new THREE.Vector3(this.fiber1.userData.cableType === 'in' ? 1.5 : -1.5, 0, 0)
    );
    midStartPoint.y = yLevel;

    // The last control point, also at the connection's Y-level
    const midEndPoint = tubeAnchorEnd.clone().add(
      new THREE.Vector3(this.fiber2.userData.cableType === 'in' ? 1.5 : -1.5, 0, 0)
    );
    midEndPoint.y = yLevel;

    // Intermediate points to guide the path across the Z-axis, maintaining the Y-level
    const midPoint1 = new THREE.Vector3(
      (tubeAnchorStart.x + tubeAnchorEnd.x) / 2,
      yLevel,
      tubeAnchorStart.z // Z-position closer to the start fiber
    );
    const midPoint2 = new THREE.Vector3(
      (tubeAnchorStart.x + tubeAnchorEnd.x) / 2,
      yLevel,
      tubeAnchorEnd.z // Z-position closer to the end fiber
    );

    return [midStartPoint, midPoint1, midPoint2, midEndPoint];
  }


  private createStripedMaterial(baseColor: THREE.Color): THREE.MeshPhongMaterial {
    // ... your existing createStripedMaterial method (no changes) ...
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

  /**
   * Clears existing children and rebuilds the connection tubes within this.mesh
   * using current fiber positions and this.controlPoints.
   */
  private rebuildConnectionMesh(): void {
    // 1. Clear existing children from this.mesh and dispose their resources
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0] as THREE.Mesh; // Assuming children are Meshes
      this.mesh.remove(child);
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        // If material is an array
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            m.dispose();
          });
        } else { // If material is single
          child.material.dispose();
        }
      }
    }

    // 2. Get current anchor points from fibers
    const fiber1WorldPos = new THREE.Vector3();
    const fiber2WorldPos = new THREE.Vector3();
    this.fiber1.getWorldPosition(fiber1WorldPos);
    this.fiber2.getWorldPosition(fiber2WorldPos);

    const tubeActualStartPoint = fiber1WorldPos.clone();
    tubeActualStartPoint.x += this.fiber1.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;
    const tubeActualEndPoint = fiber2WorldPos.clone();
    tubeActualEndPoint.x += this.fiber2.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;

    // 3. Construct the full list of points for CatmullRomCurve3
    //    [actualStart, ...this.controlPoints (4 of them), actualEnd]
    const curveDefiningPoints = [
      tubeActualStartPoint,
      ...this.controlPoints, // Spread the 4 stored control points
      tubeActualEndPoint
    ];

    // Ensure there are enough points for the curve
    if (curveDefiningPoints.length < 2) {
      console.warn("FiberConnection: Not enough points to create a curve.");
      return;
    }
    const curve = new THREE.CatmullRomCurve3(curveDefiningPoints);

    // 4. Create materials (same as your original logic)
    const fiber1Color = new THREE.Color(this.fiber1.userData.originalColor);
    const material1 = this.fiber1.userData.isMarked
      ? this.createStripedMaterial(fiber1Color)
      : new THREE.MeshPhongMaterial({ color: fiber1Color, side: THREE.DoubleSide });

    const fiber2Color = new THREE.Color(this.fiber2.userData.originalColor);
    const material2 = this.fiber2.userData.isMarked
      ? this.createStripedMaterial(fiber2Color)
      : new THREE.MeshPhongMaterial({ color: fiber2Color, side: THREE.DoubleSide });

    // 5. Create tube geometries and meshes, add them to this.mesh
    const allCurvePoints = curve.getPoints(50); // 51 points for 50 segments
    if (allCurvePoints.length < 2) return; // Not enough points from curve

    const midIndex = Math.floor(allCurvePoints.length / 2);

    const points1 = allCurvePoints.slice(0, midIndex + 1); // Include midpoint for overlap
    if (points1.length >= 2) {
      let geometry1 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points1), 20, 0.05, 8, false);
      // The reassignment below is redundant if parameters are same, but kept for structural similarity
      geometry1 = new THREE.TubeGeometry(geometry1.parameters.path, geometry1.parameters.tubularSegments, geometry1.parameters.radius, geometry1.parameters.radialSegments, geometry1.parameters.closed);
      const tube1 = new THREE.Mesh(geometry1, material1);
      this.mesh.add(tube1);
    }

    const points2 = allCurvePoints.slice(midIndex); // Start from midpoint
    if (points2.length >= 2) {
      let geometry2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points2), 20, 0.05, 8, false);
      geometry2 = new THREE.TubeGeometry(geometry2.parameters.path, geometry2.parameters.tubularSegments, geometry2.parameters.radius, geometry2.parameters.radialSegments, geometry2.parameters.closed);
      const tube2 = new THREE.Mesh(geometry2, material2);
      this.mesh.add(tube2);
    }
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public update(): void {
    // This is called when fibers are dragged or control points are modified.
    // It needs to use the current fiber positions and the current state of this.controlPoints.
    this.rebuildConnectionMesh();
  }

  /**
   * Calculates and returns the world positions of the 4 intermediate points
   * that define the curve's shape, which can be used as potential control points.
   * These are copies of the internally stored control points.
   */
  public getPotentialEditablePointsWorldPositions(): THREE.Vector3[] {
    // Return clones of the currently stored control points
    return this.controlPoints.map(p => p.clone());
  }

  /**
   * Sets the world position of an editable control point.
   * @param index The index of the control point to modify (0 to 3, corresponding to the 4 editable points).
   * @param position The new world position for the control point.
   */
  public setControlPointWorld(index: number, position: THREE.Vector3): void {
    if (index >= 0 && index < this.controlPoints.length) {
      // CASE 3: A point is dragged. The connection is now "manual".
      if (this.slotIndex !== undefined && this.slotIndex >= 0) {
        console.log(`Connection releasing slot ${this.slotIndex} due to manual modification.`);
        this.connectionManager.releaseSlot(this.slotIndex);
        this.slotIndex = -1; // Mark as unmanaged
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
    // The rebuildConnectionMesh already has logic to clear children and dispose their resources.
    // We just need to ensure all children are removed and disposed.
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0] as THREE.Mesh;
      this.mesh.remove(child); // Remove from parent group
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            m.dispose();
          });
        } else {
          child.material.dispose();
        }
      }
    }


    // The main group `this.mesh` itself doesn't need explicit disposal unless it has
    // specific resources, but its children (the tubes) are what matter here.
  }

  public getControlPointsData(): ControlPointData[] {
    return this.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));
  }


}