export type T_NotificationTypes = "addNote" 

export interface INotification {
    id: string,
	variant: "error" | "success" | "info" | "warning",
	icon?: boolean,
    message: string,
    autoHideDuration: number
}

export interface INotificationSlice {
    notifications: INotification[]
}