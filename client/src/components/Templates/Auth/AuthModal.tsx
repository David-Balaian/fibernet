import { Fragment, useEffect, useState } from 'react'
import { Dialog, DialogTitle, TextField, Button, CircularProgress, InputProps } from '@mui/material'
import { ICredentials, IRegister } from 'src/utils/types'
import { useAppDispatch, useAppSelector } from 'src/store/StoreHooks'
import { getAuthError, getAuthLoading } from 'src/store/User/selectors'
import { TH_Register, TH_SignIn } from 'src/store/User/thunk'
import userSlice from 'src/store/User/slice'

const textFieldSx = { mx: 2, my: 0.5 }

interface IProps {
  open: boolean,
  isRegisterMode: boolean,
  close: () => void,
  toggleRegister: () => void,
}

export default function AuthModal({ open, close, isRegisterMode, toggleRegister }: IProps) {
  const dispatch = useAppDispatch()

  const [formData, setFormData] = useState({} as ICredentials | IRegister)
  const loading = useAppSelector(getAuthLoading)
  const error = useAppSelector(getAuthError)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const clickSubmit = () => {
    isRegisterMode ? dispatch(TH_Register({formData, onSuccess: close} as {formData: IRegister, onSuccess: ()=>void})) : dispatch(TH_SignIn({formData, onSuccess: close} as {formData: ICredentials, onSuccess: ()=>void}))
  }

  useEffect(()=>{
    return ()=>{
      setFormData({} as ICredentials)
      dispatch(userSlice.actions.setError(null))
    }
  }, [open])
  

  const disabledLoginButton = !formData['email'] || !formData['password']
  const disabledRegisterButton = !formData['email'] || !formData['password']

  return (
    <Dialog open={open} onClose={close}>
      {isRegisterMode ? (
        <RegisterForm formData={formData as IRegister} handleChange={handleChange} />
      ) : (
        <LoginForm formData={formData as ICredentials} handleChange={handleChange} />
      )}

      {error && <span className='error'>{error}</span>}

      {loading ? (
        <center>
          <CircularProgress color='inherit' />
        </center>
      ) : (
        <Button
          onClick={clickSubmit}
          disabled={isRegisterMode ? disabledRegisterButton : disabledLoginButton}>
          {isRegisterMode ? 'Register' : 'Login'}
        </Button>
      )}

      <Button onClick={toggleRegister}>
        {isRegisterMode ? 'I already have an account' : "I don't have an account"}
      </Button>
    </Dialog>
  )
}

interface IPropsLogin {
  formData: ICredentials,
  handleChange: InputProps["onChange"]
}

function LoginForm({ formData, handleChange }: IPropsLogin) {
  return (
    <Fragment>
      <DialogTitle>Login to your account</DialogTitle>

      <TextField
        label='Email'
        name='email'
        type='text'
        value={formData['email'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
      <TextField
        label='Password'
        name='password'
        type='password'
        value={formData['password'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
    </Fragment>
  )
}

interface IPropsRegister {
  formData: IRegister,
  handleChange: InputProps["onChange"]
}

function RegisterForm({ formData, handleChange }: IPropsRegister) {
  return (
    <Fragment>
      <DialogTitle>Create a new account</DialogTitle>

      <TextField
        label='email'
        name='email'
        type='text'
        value={formData['email'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
      <TextField
        label='First Name'
        name='firstName'
        type='firstName'
        value={formData['firstName'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
      <TextField
        label='Last Name'
        name='lastName'
        type='lastName'
        value={formData['lastName'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
      <TextField
        label='Password'
        name='password'
        type='password'
        value={formData['password'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
      <TextField
        label='Confirm Password'
        name='confirmPassword'
        type='confirmPassword'
        value={formData['confirmPassword'] || ''}
        onChange={handleChange}
        variant='filled'
        sx={textFieldSx}
        required
      />
    </Fragment>
  )
}
