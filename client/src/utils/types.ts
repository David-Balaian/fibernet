export interface ICredentials {
    email: string,
    password: string
}

export interface IRegister {
    email: string,
    firstName: string,
    lastName: string,
    password: string
    confirmPassword: string
}


export interface IUser {
    email: string,
    firstName: string,
    lastName: string,
    role: string
}

export type Splitter = {
    name: string;
    id: string;
    inputs: { id: string; parentId: string; color?: string }[];
    outputs: { id: string; parentId: string; color?: string }[];
}

export interface MapPoint {
    id: string | number; // Unique ID for React key
    lat: number;
    lng: number;
}