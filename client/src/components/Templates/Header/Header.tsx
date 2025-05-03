import {Fragment, MouseEvent, useState} from 'react'
import {
  AppBar,
  IconButton,
  Avatar,
  Popover,
  List,
  ListSubheader,
  ListItemButton,
} from '@mui/material'
import OnlineIndicator from '../OnlineIndicator/OnlineIndicator'
import AuthModal from '../Auth/AuthModal'
import { useAppDispatch, useAppSelector } from 'src/store/storeHooks'
import { getAccount, getAuthStatus } from 'src/store/user/selectors'
import userSlice from 'src/store/user/slice'

export default function Header() {
  const dispatch = useAppDispatch()
  const isLoggedIn = useAppSelector(getAuthStatus)
  const account = useAppSelector(getAccount)
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [popover, setPopover] = useState(false)
  const [authModal, setAuthModal] = useState(false)
  const [register, setRegister] = useState(false)

  const handleLogout = () => {
    dispatch(userSlice.actions.logout())
  }

  const openPopover = (e: MouseEvent<HTMLButtonElement>) => {
    setPopover(true)
    setAnchorEl(e.currentTarget)
  }

  const closePopover = () => {
    setPopover(false)
    setAnchorEl(null)
  }

  const clickLogin = () => {
    setRegister(false)
    setAuthModal(true)
    closePopover()
  }

  const clickRegister = () => {
    setRegister(true)
    setAuthModal(true)
    closePopover()
  }

  return (
    <AppBar className='header' position='static'>
      <h1>Web App</h1>

      <IconButton onClick={openPopover}>
        <OnlineIndicator online={isLoggedIn}>
          <Avatar src={account?.firstName || ''} alt={account?.firstName || ''} />
        </OnlineIndicator>
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={popover}
        onClose={closePopover}
        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
        transformOrigin={{vertical: 'top', horizontal: 'right'}}>
        <List style={{minWidth: '100px'}}>
          <ListSubheader style={{textAlign: 'center'}}>
            Hello, {isLoggedIn ? `${account?.firstName} ${account?.lastName}` : 'Guest'}
          </ListSubheader>

          {isLoggedIn ? (
            <ListItemButton onClick={handleLogout}>Logout</ListItemButton>
          ) : (
            <Fragment>
              <ListItemButton onClick={clickLogin}>Login</ListItemButton>
              <ListItemButton onClick={clickRegister}>Reigster</ListItemButton>
            </Fragment>
          )}
        </List>
      </Popover>

      <AuthModal
        open={authModal}
        close={() => setAuthModal(false)}
        isRegisterMode={register}
        toggleRegister={() => setRegister((prev) => !prev)}
      />
    </AppBar>
  )
}
