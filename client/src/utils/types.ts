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