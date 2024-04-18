import React from 'react'
import ReactDOM from "react-dom/client";

import App from './App'
import CssBaseline from '@mui/material/CssBaseline'
import './styles/index.css'
import { Provider } from 'react-redux';
import { store } from './store/config';

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);


root.render(
  <React.StrictMode>
    <Provider store={store}>
      <CssBaseline />
      <App />
    </Provider>
  </React.StrictMode>,
)
