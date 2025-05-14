import * as THREE from 'three';
import { FIBER_HEIGHT } from './OpticalCableDrawer';

export class FiberConnection {
  private fiber1: THREE.Mesh;
  private fiber2: THREE.Mesh;
  private mesh: THREE.Group;

  constructor(fiber1: THREE.Mesh, fiber2: THREE.Mesh) {
    this.fiber1 = fiber1;
    this.fiber2 = fiber2;
    this.mesh = this.createConnectionMesh();
  }

  private createStripedMaterial(baseColor: THREE.Color): THREE.MeshPhongMaterial {
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
      const position = spacing * (i + 1) - stripeHeight/2;
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

  private createConnectionMesh(): THREE.Group {
    const group = new THREE.Group();

    // [Keep original positioning and curve creation code unchanged]
    const startPoint = new THREE.Vector3();
    const endPoint = new THREE.Vector3();
    this.fiber1.getWorldPosition(startPoint);
    this.fiber2.getWorldPosition(endPoint);
    
    startPoint.x += this.fiber1.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;
    endPoint.x += this.fiber2.userData.cableType === 'in' ? (FIBER_HEIGHT / 2) - 0.1 : -(FIBER_HEIGHT / 2) + 0.1;

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

    const points = [
      startPoint,
      midStartPoint,
      midPoint1,
      midPoint2,
      midEndPoint,
      endPoint
    ];
    const curve = new THREE.CatmullRomCurve3(points);

    // First half material
    const fiber1Color = new THREE.Color(this.fiber1.userData.originalColor);
    const material1 = this.fiber1.userData.isMarked
      ? this.createStripedMaterial(fiber1Color)
      : new THREE.MeshPhongMaterial({
          color: fiber1Color,
          side: THREE.DoubleSide
        });

    // Second half material
    const fiber2Color = new THREE.Color(this.fiber2.userData.originalColor);
    const material2 = this.fiber2.userData.isMarked
      ? this.createStripedMaterial(fiber2Color)
      : new THREE.MeshPhongMaterial({
          color: fiber2Color,
          side: THREE.DoubleSide
        });

    // First half geometry
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

    // Second half geometry
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