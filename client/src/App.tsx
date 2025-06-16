import { useEffect, useState } from 'react'
import Header from './components/Templates/Header/Header'
import { useAppDispatch, useAppSelector } from './store/storeHooks'
import { getAccount, getAuthStatus } from './store/user/selectors'
import { getUserFromLS } from './utils/helperFunctions'
import userSlice from './store/user/slice'
import OpticalCableVisualizer from './components/Templates/fibersConnection'
import InteractiveMap from './components/Templates/Maps/InteractiveMap'
import { MapPoint } from './utils/types'

export default function App() {
  const dispatch = useAppDispatch()
  const isLoggedIn = useAppSelector(getAuthStatus) 
  const [mode, setMode] = useState<"map" | "cable">("map")

  useEffect(()=>{
    const accountLS = getUserFromLS()
    if(!isLoggedIn && accountLS){
      dispatch(userSlice.actions.loginFromLS(accountLS))
    }
  }, [isLoggedIn])

  const markers: MapPoint[] = [
    { id: 1, lat: 40.1792, lng: 44.5152 }, // Yerevan Center
    { id: 2, lat: 40.2050, lng: 44.5250 }, // Near Komitas Pantheon
    { id: 3, lat: 40.1522, lng: 44.4852 }, // Near Erebuni Museum
  ];


  return (
    <div className='App'>
      <Header setMode={setMode} />

      {/* {isLoggedIn ? <LoggedInText /> : <LoggedOutText />} */}
      {mode === "cable" ? <OpticalCableVisualizer /> : <InteractiveMap points={markers} />}
    </div>
  )
}

const LoggedInText = () => {
  const account = useAppSelector(getAccount)

  return <p>Hey, {account?.firstName}! I'm happy to let you know: you are authenticated!</p>
}

const LoggedOutText = () => (
  <p>Don't forget to start your backend server, then authenticate yourself.</p>
)
