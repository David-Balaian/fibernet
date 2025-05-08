import * as THREE from 'three';
export class FiberConnection {
  private fiber1: THREE.Mesh;
  private fiber2: THREE.Mesh;
  private mesh: THREE.Group;

  constructor(fiber1: THREE.Mesh, fiber2: THREE.Mesh) {
    this.fiber1 = fiber1;
    this.fiber2 = fiber2;
    this.mesh = this.createConnectionMesh();
  }

  private createConnectionMesh(): THREE.Group {
    const group = new THREE.Group();

    const startPoint = new THREE.Vector3();
    const endPoint = new THREE.Vector3();
    this.fiber1.getWorldPosition(startPoint);
    this.fiber2.getWorldPosition(endPoint);
    // Get start and end points
    startPoint.x += this.fiber1.userData.cableType === 'in' ? 0.5 : -0.5;
    endPoint.x += this.fiber2.userData.cableType === 'in' ? 0.5 : -0.5;
    // Adjust for fiber length (assuming fibers are along y-axis)
    // startPoint.y += 0.5; // Start at top of first fiber
    // endPoint.y -= 0.5;   // End at bottom of second fiber

    // Create control points for smooth curve
    const midPoint1 = new THREE.Vector3(
      (startPoint.x + endPoint.x) / 2,
      startPoint.y,
      (startPoint.z + endPoint.z) / 2
    );
    const midPoint2 = new THREE.Vector3(
      (startPoint.x + endPoint.x) / 2,
      endPoint.y,
      (startPoint.z + endPoint.z) / 2
    );

    const midStartPoint = startPoint.clone().add(
      new THREE.Vector3(this.fiber1.userData.cableType === 'in' ? 0.5 : -0.5, 0, 0)
    );
    const midEndPoint = endPoint.clone().add(
      new THREE.Vector3(this.fiber2.userData.cableType === 'in' ? 0.5 : -0.5, 0, 0)
    );

    this.fiber1.userData.cableType === 'in' ? 0.5 : -0.5;

    // Create Catmull-Rom curve
    const points = [
      startPoint,
      midStartPoint,
      midPoint1,
      midPoint2,
      midEndPoint,
      endPoint
    ];
    const curve = new THREE.CatmullRomCurve3(points);

    // First half (fiber1 color)
    const points1 = curve.getPoints(50).slice(0, 26);
    const geometry1 = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points1),
      20,
      0.05,
      8,
      false
    );
    const material1 = new THREE.MeshPhongMaterial({
      color: (this.fiber1.material as THREE.MeshPhongMaterial).color,
      side: THREE.DoubleSide
    });
    const tube1 = new THREE.Mesh(geometry1, material1);
    group.add(tube1);

    // Second half (fiber2 color)
    const points2 = curve.getPoints(50).slice(25);
    const geometry2 = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points2),
      20,
      0.05,
      8,
      false
    );
    const material2 = new THREE.MeshPhongMaterial({
      color: (this.fiber2.material as THREE.MeshPhongMaterial).color,
      side: THREE.DoubleSide
    });
    const tube2 = new THREE.Mesh(geometry2, material2);
    group.add(tube2);

    return group;
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }
  public update(): void {
    this.mesh.clear();
    this.mesh = this.createConnectionMesh();
  }
}