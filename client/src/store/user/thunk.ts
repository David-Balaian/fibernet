import { createAsyncThunk } from '@reduxjs/toolkit';
import { R_Register, R_SignIn } from '../../api/auth/service';
import { ICredentials, IRegister } from '../../utils/types';
import { handleResponseError } from '../../api/config';
import { AxiosError } from 'axios';
export const TH_SignIn = createAsyncThunk(
    'user/signIn',
    async (data: {formData: ICredentials, onSuccess: ()=>void}, thunkAPI) => {
        try {
            const response = await R_SignIn(data.formData);
            data.onSuccess()
            return response;
        } catch (error) {
            thunkAPI.rejectWithValue(error)
            return handleResponseError(error as AxiosError, thunkAPI)
        }
    }
);

export const TH_Register = createAsyncThunk(
    'user/Register',
    async (data: {formData: IRegister, onSuccess: ()=>void}, thunkAPI) => {
        try {
            const response = await R_Register(data.formData);
            data.onSuccess()
            return response;
        } catch (error) {
            return handleResponseError(error as AxiosError, thunkAPI)
        }
    }
);