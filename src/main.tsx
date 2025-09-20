import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/tailwind.css';
import App from './app/App';
import DisplayPage from './pages/DisplayPage';
import SetupPage from './pages/SetupPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DisplayPage /> },
      { path: 'display', element: <DisplayPage /> },
      { path: 'setup', element: <SetupPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);