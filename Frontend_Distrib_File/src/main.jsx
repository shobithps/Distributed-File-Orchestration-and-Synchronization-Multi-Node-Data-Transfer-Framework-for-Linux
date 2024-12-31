import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure Tailwind CSS is included

import App from './App.jsx';
import { SocketProvider } from './contexts/SocketContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>
);
