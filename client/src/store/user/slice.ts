import { createSlice } from '@reduxjs/toolkit';
import { IUser } from '../../utils/types';
import { TH_Register, TH_SignIn } from './thunk';
import { removeToken, removeUserFromLS } from 'src/utils/helperFunctions';

interface UserState {
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  account: IUser | null
}

const initialState: UserState = {
  isLoading: false,
  isAuthenticated: false,
  error: null,
  account: null
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    loginFromLS: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.error = null;
      state.account = action.payload
    },
    logout: (state) => {
      state.isLoading = false;
      state.isAuthenticated = false;
      state.error = null;
      state.account = null
      removeUserFromLS()
      removeToken()
    },
    setError: (state, action)=>{
      state.error = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(TH_SignIn.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(TH_SignIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.error = null;
        state.account = action.payload as IUser
      })
      .addCase(TH_SignIn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(TH_Register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(TH_Register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.error = null;
        state.account = action.payload as IUser
      })
      .addCase(TH_Register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },

});

export default userSlice;
