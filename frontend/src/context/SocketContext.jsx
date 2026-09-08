import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import API_URL from "../../config";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    const newSocket = io(API_URL, {
      auth: { token },
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.io");
      // Join user room
      const user = JSON.parse(sessionStorage.getItem("user") || "null");

      if (user?.id) {
        newSocket.emit("join", user.id);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
