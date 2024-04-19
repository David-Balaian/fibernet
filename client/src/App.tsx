import { useEffect } from 'react'
import Header from './components/Templates/Header/Header'
import { useAppDispatch, useAppSelector } from './store/StoreHooks'
import { getAccount, getAuthStatus } from './store/User/selectors'
import { getUserFromLS } from './utils/helperFunctions'
import userSlice from './store/User/slice'

export default function App() {
  const dispatch = useAppDispatch()
  const isLoggedIn = useAppSelector(getAuthStatus) 

  useEffect(()=>{
    const accountLS = getUserFromLS()
    if(!isLoggedIn && accountLS){
      dispatch(userSlice.actions.loginFromLS(accountLS))
    }
  }, [isLoggedIn])

  return (
    <div className='App'>
      <Header />

      {isLoggedIn ? <LoggedInText /> : <LoggedOutText />}
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
