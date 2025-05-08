import * as THREE from 'three';

export class FiberConnection {
    private curve: THREE.CatmullRomCurve3;
    private tubeGeometry: THREE.TubeGeometry;
    private mesh: THREE.Mesh;
    private points: THREE.Vector3[] = [];
    private startFiber: THREE.Mesh;
    private endFiber: THREE.Mesh;
  
    constructor(startFiber: THREE.Mesh, endFiber: THREE.Mesh) {
      this.startFiber = startFiber;
      this.endFiber = endFiber;
  
      // Initial straight line between fibers
      this.points = [
        startFiber.position.clone(),
        new THREE.Vector3().lerpVectors(
          startFiber.position,
          endFiber.position,
          0.5
        ),
        endFiber.position.clone()
      ];
  
      this.createCurve();
    }
  
    private createCurve() {
      this.curve = new THREE.CatmullRomCurve3(this.points);
      this.tubeGeometry = new THREE.TubeGeometry(this.curve, 64, 0.05, 16, false);
      
      // Create gradient material
      const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      });
      
      // Set vertex colors for gradient effect
      const colors = [];
      const halfVertices = this.tubeGeometry.attributes.position.count / 2;
      for (let i = 0; i < this.tubeGeometry.attributes.position.count; i++) {
        const color = i < halfVertices 
          ? new THREE.Color(this.startFiber.material.color) 
          : new THREE.Color(this.endFiber.material.color);
        colors.push(color.r, color.g, color.b);
      }
      this.tubeGeometry.setAttribute(
        'color', 
        new THREE.Float32BufferAttribute(colors, 3)
      );
  
      this.mesh = new THREE.Mesh(this.tubeGeometry, material);
      return this.mesh;
    }
  
    public addControlPoint(position: THREE.Vector3) {
      // Add a new control point at the clicked position
      this.points.splice(this.points.length - 1, 0, position);
      this.updateCurve();
    }
  
    public moveControlPoint(index: number, newPosition: THREE.Vector3) {
      if (index > 0 && index < this.points.length - 1) {
        this.points[index].copy(newPosition);
        this.updateCurve();
      }
    }
  
    private updateCurve() {
      this.curve.points = this.points;
      this.curve.updateArcLengths();
      
      // Create new geometry with updated curve
      const newGeometry = new THREE.TubeGeometry(this.curve, 64, 0.05, 16, false);
      
      // Copy vertex colors to new geometry
      const colors = this.tubeGeometry.attributes.color.array;
      newGeometry.setAttribute(
        'color', 
        new THREE.Float32BufferAttribute(colors, 3)
      );
      
      this.mesh.geometry.dispose();
      this.mesh.geometry = newGeometry;
    }
  
    public getMesh() {
      return this.mesh;
    }
  }