import axios, { AxiosError } from 'axios'
import { BACKEND_URL } from '../constants'
import { BaseThunkAPI } from '@reduxjs/toolkit/dist/createAsyncThunk'

const api = axios.create({
  baseURL: BACKEND_URL,
})

export default api


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleResponseError = (err: AxiosError, storeValues?: BaseThunkAPI<any, any, any, any>) => {
	const message = (err?.response?.data as {message: string})?.message || err?.toString() || ""
	// storeValues?.dispatch(showNotification({
	// 	id: uuid(),
	// 	type: "error",
	// 	text: message,
	// 	icon: false,
	// }))
	return storeValues?.rejectWithValue(message)
}