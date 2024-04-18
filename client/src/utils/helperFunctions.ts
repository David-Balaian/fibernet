import { IUser } from "./types"

export const saveUserToLS = (data: IUser & { authStatus: boolean }) => {
	localStorage.setItem("userInfo", JSON.stringify(data))
}

export const removeUserFromLS = () => {
	localStorage.removeItem("userInfo")
}

export const getUserFromLS = () => {
	const user = localStorage.getItem("userInfo")
    if(user){
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

