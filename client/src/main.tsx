import React from 'react'
import ReactDOM from "react-dom/client";
import CssBaseline from '@mui/material/CssBaseline'
import './styles/index.css'
import { Provider } from 'react-redux';
import { store } from './store/Config';
import { RouterProvider } from 'react-router-dom';
import router from './routes/config';
import { SnackbarProvider } from 'notistack';
import { notificationsConfig } from './utils/constants';

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);


root.render(
  <React.StrictMode>
    <Provider store={store}>
      <SnackbarProvider {...notificationsConfig} >
        <CssBaseline />
        <RouterProvider router={router} />
      </SnackbarProvider>
    </Provider>
  </React.StrictMode>,
)
