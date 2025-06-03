import { Connection } from "src/components/Templates/fibersConnection/canvasDraw"
import { ControlPointData, FiberConnection } from "./threeJSHelpers/fiberConnections"
import { IUser } from "./types"
import { v4 } from "uuid"

export const saveUserToLS = (data: IUser & { authStatus: boolean }) => {
	localStorage.setItem("userInfo", JSON.stringify(data))
}

export const removeUserFromLS = () => {
	localStorage.removeItem("userInfo")
}

export const getUserFromLS = () => {
	const user = localStorage.getItem("userInfo")
	if (user) {
		return JSON.parse(user) as IUser
	}
	return null
}

export const saveToken = (token: string) => {
	localStorage.setItem("token", JSON.stringify(token))
}

export const getToken = () => {
	const token = localStorage.getItem("token")
	return token
}

export const removeToken = () => {
	localStorage.removeItem("token")
}


/**
 * Takes a FiberConnection instance and returns a serializable object
 * containing the data required to recreate it later.
 *
 * @param connection - The FiberConnection instance to serialize.
 * @returns A StorableConnection object or null if serialization fails.
 */
export const getConnectionSerializableData = (connection: FiberConnection) => {
	if (!connection || !(connection instanceof FiberConnection)) {
		console.error("Invalid connection object passed to getConnectionSerializableData.");
		return null;
	}

	const fiber1Id = connection.fiber1.id;
	const fiber2Id = connection.fiber2.id;

	if (!fiber1Id || !fiber2Id) {
		console.error("Could not generate storable IDs for one or both fibers in the connection.", connection);
		return null; // Cannot serialize without valid fiber IDs
	}

	// Assuming getControlPointsData() exists on FiberConnection and returns ControlPointData[]
	const controlPointsData = connection.getControlPointsData();

	return {
		fiber1Id: fiber1Id,
		fiber2Id: fiber2Id,
		controlPoints: controlPointsData,
	};
};

export const save3DConnectionsToLocalStorage = (connections: FiberConnection[]) => {
	const serializable: ThreeJSData[] = connections.map(conn => ({
		points: conn.getControlPointsData(),
		fiber1Id: conn.fiber1.userData.fiberId,
		fiber2Id: conn.fiber2.userData.fiberId,
		fiber1CableType: conn.fiber1.userData.cableType,
		fiber2CableType: conn.fiber2.userData.cableType,
		fiber1CableId: conn.fiber1.userData.cableId,
		fiber2CableId: conn.fiber2.userData.cableId,
		color1: conn.fiber1.userData.color,
		color2: conn.fiber2.userData.color
	}))
	localStorage.setItem("connections3D", JSON.stringify(serializable));
	const serializable2D = serializable.map(item => threeJSToCanvas(item))
	localStorage.setItem("connections2D", JSON.stringify(serializable2D));
}


export const save2DConnectionsToLocalStorage = (connections: Connection[]) => {
	const serializable = connections
	localStorage.setItem("connections2D", JSON.stringify(serializable));
	const serializable3D = serializable.map(item => canvasToThreeJS(item))
	localStorage.setItem("connections3D", JSON.stringify(serializable3D));
}


// Define the interfaces for the data structures

interface Point2D {
	x: number;
	y: number;
}

interface Point3D {
	x: number;
	y: number;
	z: number;
}

interface ControlPoint extends Point2D {
	radius: number;
}

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

// Input for canvasToThreeJS, Output for threeJSToCanvas
interface CanvasData {
	id: string;
	fiber1Id: string;
	fiber2Id: string;
	path?: Point2D[];
	color1: string;
	color2: string;
	deleteIconRect?: Rect;
	fiber1CableType?: string
	fiber2CableType?: string
	fiber1CableId?: string
	fiber2CableId?: string
}

// Output for canvasToThreeJS, Input for threeJSToCanvas
interface ThreeJSData {
	points?: ControlPointData[];
	fiber1Id: string;
	fiber2Id: string;
	fiber1CableType?: string;
	fiber2CableType?: string;
	fiber1CableId?: string;
	fiber2CableId?: string;
	color1: string
	color2: string
}

/**
 * Converts canvas-like data to Three.js-like data.
 * If the input matches the structure of the provided example, it returns the exact example output.
 * Otherwise, it applies a generic transformation.
 * @param data The input CanvasData object.
 * @returns The transformed ThreeJSData object.
 */
export function canvasToThreeJS(data: CanvasData): ThreeJSData {
	// let outputPoints: Point3D[];
	let outputFiber1Id = data.fiber1Id;
	let outputFiber2Id = data.fiber2Id;
	// const pointsToTransform = data.path?.slice(0, Math.min(data.path.length, 4)) || [];
	// outputPoints = pointsToTransform?.map((p, index) => ({
	// 	x: (p.x - 500) / 100, // Arbitrary scaling factor
	// 	y: (p.y - 200) / 100, // Arbitrary scaling factor
	// 	z: index * 0.5        // Arbitrary Z coordinate based on index
	// })) || [];

	return {
		// points: outputPoints,
		fiber1Id: outputFiber1Id,
		fiber2Id: outputFiber2Id,
		fiber1CableType: data.fiber1CableType,
		fiber2CableType: data.fiber2CableType,
		fiber1CableId: data.fiber1CableId,
		fiber2CableId: data.fiber2CableId,
		color1: data.color1,
		color2: data.color2
	};
}

/**
 * Converts Three.js-like data back to canvas-like data.
 * If the input matches the structure of the example Three.js output,
 * it attempts to reconstruct the original example CanvasData.
 * Otherwise, it applies a generic reverse transformation.
 * @param data The input ThreeJSData object.
 * @returns The transformed CanvasData object.
 */
export function threeJSToCanvas(data: ThreeJSData): CanvasData {
	let outputPath: Point2D[];
	let outputControlPoints: ControlPoint[];
	let outputDeleteIconRect: Rect;
	let outputColor1 = data.color1; // Default to example
	let outputColor2 = data.color2; // Default to example
	let outputId = `conn-${v4()}`;
	let outputFiber1Id = data.fiber1Id;
	let outputFiber2Id = data.fiber2Id;

	// Check if the input data matches the specific example's ThreeJSData output structure
	// General case:
	// This is a placeholder inverse transformation.
	// The actual inverse depends on the forward transformation used in canvasToThreeJS's general case.
	// outputPath = data.points?.map(p => ({
	// 	x: Math.round(p.x * 100 + 500), // Inverse of arbitrary scaling
	// 	y: Math.round(p.y * 100 + 200)  // Inverse of arbitrary scaling
	// })) || [];

	// outputControlPoints = outputPath.map(p => ({
	// 	x: p.x,
	// 	y: p.y,
	// 	radius: 4 // Default radius
	// }));
		outputDeleteIconRect = { x: 0, y: 0, width: 16, height: 16 };

	return {
		id: outputId,
		fiber1Id: outputFiber1Id,
		fiber2Id: outputFiber2Id,
		color1: outputColor1,
		color2: outputColor2,
		path: [],
		deleteIconRect: outputDeleteIconRect,
		fiber1CableType: data.fiber1CableType,
		fiber2CableType: data.fiber2CableType,
		fiber1CableId: data.fiber1CableId,
		fiber2CableId: data.fiber2CableId,
	};
}
