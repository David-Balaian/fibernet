import { Suspense, useEffect, useRef } from "react"
import { Outlet } from "react-router-dom"
import styles from "./styles.module.css"
import PopupsRoot from "../Popups/PopupsRoot"
import { removeToken, removeUserFromLS } from "src/utils/helperFunctions"
import useNotification from "../../../utils/hooks/useNotification"

export const Layout = () => {
    useNotification()
    const timeoutId = useRef<number | null>(null)
    const INACTIVITY_TIMEOUT = 21600000 // 6 hours

    const handleUserActivity = () => {
        if (timeoutId.current) clearTimeout(timeoutId.current)
        timeoutId.current = setTimeout(() => {
            removeUserFromLS()
            removeToken()
        }, INACTIVITY_TIMEOUT)
    }

    useEffect(() => {
        window.addEventListener("mousemove", handleUserActivity)
        window.addEventListener("mouseup", handleUserActivity)
        return () => {
            window.removeEventListener("mousemove", handleUserActivity)
            window.removeEventListener("mouseup", handleUserActivity)
        }
    }, [])

    return <div className={styles.layoutContainer}>
        <Suspense fallback={
            // <ThreeDots
            //     visible={true}
            //     height="80"
            //     width="80"
            //     color="#4fa94d"
            //     radius="9"
            //     ariaLabel="three-dots-loading"
            // />
            <div>Loading ...</div>
        }>
            <PopupsRoot />
            <Outlet />
        </Suspense>
    </div>
}