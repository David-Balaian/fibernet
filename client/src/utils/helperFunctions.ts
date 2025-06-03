import { FiberConnection } from "./threeJSHelpers/fiberConnections"
import { IUser } from "./types"

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


export const saveConnectionsToLocalStorage = (connections: FiberConnection[]) => {
	const serializable = connections.map(conn => ({
		points: conn.getControlPointsData(),
		fiber1Id: conn.fiber1.userData.fiberId,
		fiber2Id: conn.fiber2.userData.fiberId,
		fiber1CableType: conn.fiber1.userData.cableType,
		fiber2CableType: conn.fiber2.userData.cableType,
		fiber1CableId: conn.fiber1.userData.cableId,
		fiber2CableId: conn.fiber2.userData.cableId
	}))
	localStorage.setItem("connections", JSON.stringify(serializable));
	console.log(serializable, "serializable connections");
}
