import { ICredentials, IRegister, IUser } from "../../utils/types"


export interface T_signIn {
    args: ICredentials, 
    response: IUser & {token: string}
}

export interface T_Register {
    args: IRegister, 
    response: IUser & {token: string}
}