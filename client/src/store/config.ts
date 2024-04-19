import { Action, ThunkAction, combineReducers, configureStore } from '@reduxjs/toolkit';
import userSlice from './User/slice';

const rootReducer = combineReducers({
	user: userSlice.reducer,
})

// Define the AppThunk type for Thunk actions
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>;


const setupStore = () => {
	return configureStore({
		reducer: rootReducer,
		middleware: (getDefaultMiddleware) => getDefaultMiddleware({serializableCheck: false})
	})
}

export const store = setupStore()
export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore["dispatch"];