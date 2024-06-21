import React from 'react';
import io from "socket.io-client"; 
const url = "http://localhost:4000";
export const socket = io.connect(url, { 
    reconnection:true,
    reconnectionDelay: 500,
    
    transports: ['websocket'],
    

});
export const SocketContext = React.createContext();