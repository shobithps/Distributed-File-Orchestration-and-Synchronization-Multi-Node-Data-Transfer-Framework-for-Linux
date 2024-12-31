import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  return useContext(SocketContext);
};

// eslint-disable-next-line react/prop-types
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io("http://192.168.156.123:65432"); // Connect once
    setSocket(newSocket);

    return () => {
      newSocket.disconnect(); // Clean up on unmount
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
