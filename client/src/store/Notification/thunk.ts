import { Dispatch } from "@reduxjs/toolkit"
import { INotification } from "./types"
import { notificationsSlice } from "./slice"

export const showNotification = (data: INotification) => (dispatch: Dispatch) => {
	dispatch(notificationsSlice.actions.addNotification({data}))
  
	setTimeout(() => {
		dispatch(notificationsSlice.actions.closeNotification({id: data.id}))
	}, data?.ms || 3000)
}
  