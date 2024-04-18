import { T_Register, T_signIn } from "./types"
import { IUser } from "../../utils/types"
import api from "../config"
import { saveToken, saveUserToLS } from "../../utils/helperFunctions"

export const R_SignIn = async (data: T_signIn['args']) => {
        const response = await api.post<T_signIn["response"]>("/auth/login", data)
        saveUserToLS({ authStatus: true, ...response.data as IUser })
        saveToken(response.data.token)
        return response.data
}

export const R_Register = async (data: T_Register['args']) => {
    const response = await api.post<T_Register["response"]>("/auth/register", data)
    saveUserToLS({ authStatus: true, ...response.data as IUser })
    saveToken(response.data.token)
    return response.data
}