import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Home from './routes/home/Home';
import reportWebVitals from './reportWebVitals';
import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import PluginList from './routes/plugins/PluginList';
import { Sample } from './routes/sample/Sample';

const router = createHashRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/plugins",
    element: <PluginList />,
  },
  {
    path: "/sample/:pluginAddress",
    element: <Sample />,
  },
]);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
