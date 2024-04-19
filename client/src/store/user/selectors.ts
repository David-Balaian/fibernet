import { RootState } from "../Config"

export const getAccount = (store: RootState) => store.user.account
export const getAuthLoading = (store: RootState) => store.user.isLoading
export const getAuthError = (store: RootState) => store.user.error
export const getAuthStatus = (store: RootState): boolean => store.user.isAuthenticated
