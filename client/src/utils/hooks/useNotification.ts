
import { useEffect } from "react"
import { getNotifications } from "../../store/Notification/selectors"
import { useAppSelector } from "src/store/StoreHooks"
import { useSnackbar } from "notistack"
import { INotification } from "src/store/Notification/types"


const useNotification = () => {
	const notifications = useAppSelector(getNotifications)
    const { enqueueSnackbar } = useSnackbar();


    useEffect(()=>{
        notifications.forEach((item: INotification)=>{
            enqueueSnackbar(item.message, { variant: item.variant });
        })

    }, [notifications])

}

export default useNotification