import { createBrowserRouter } from "react-router-dom";
import App from "src/App";

const router = createBrowserRouter([
    {
      path: "/",
      element: <App />,
      children: [],
    },
    {
      basename: "/usernet",
    }
  ]);
  
  export default router