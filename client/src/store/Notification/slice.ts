import { PayloadAction, createSlice } from "@reduxjs/toolkit"
import { INotification, INotificationSlice } from "./types"

const initialState: INotificationSlice = {
	notifications: [] 
}

export const notificationsSlice = createSlice({
	name: "notifications",
	initialState,
	reducers: {
		addNotification: (state, action: PayloadAction<{data: INotification}>) => {
			state.notifications.push(action.payload.data)
		},
		closeNotification: (state, action: PayloadAction<{id: string}>) => {
			state.notifications = state.notifications.filter(item=>item.id!==action.payload.id)
		},
	}
})

export default notificationsSlice.reducer