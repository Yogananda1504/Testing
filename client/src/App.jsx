import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chatpage from './Pages/Chat/Chatpage';
import Home from './Pages/Home/Home';
import E_404 from './Pages/error/E_404';
import E_401 from './Pages/error/E_401';
import E_500 from './Pages/error/E_500';
import { socket, SocketContext } from '../Context/SocketContext';
import E_403 from './Pages/error/E_403';
import Analyze from './Pages/Analyze/Analyze.jsx';


function App() {
  const [leftstatus, setLeftstatus] = useState(false);
  const [activitystatus, setActivitystatus] = useState(true);
  const [username, setUsername] = useState(() => sessionStorage.getItem('username') || '');
  const [room, setRoom] = useState(() => sessionStorage.getItem('room') || '');
  const [activeUsers, setActiveUsers] = useState([]);
  const [joinRoom, setJoinRoom] = useState(false);

  


  // Effect to sync username with sessionStorage
  useEffect(() => {
    if (username) {
      sessionStorage.setItem('username', username);
    } else {
      sessionStorage.removeItem('username');
    }
  }, [username]);

  // Effect to sync room with sessionStorage
  useEffect(() => {
    if (room) {
      sessionStorage.setItem('room', room);
    } else {
      sessionStorage.removeItem('room');
    }
  }, [room]);

  useEffect(() => {
    console.log("Active users updated:", activeUsers);
    if (activeUsers.length > 0) {
      sessionStorage.setItem('activeUsers', JSON.stringify(activeUsers));
    }
  }, [activeUsers]);


  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <Routes>
          <Route
            exact path="/"
            element={
              <Home
                username={username}
                setUsername={setUsername}
                room={room}
                setRoom={setRoom}
                activitystatus={activitystatus}
                setActivitystatus={setActivitystatus}
                leftstatus={leftstatus}
                setLeftstatus={setLeftstatus}
              />
            }
          />
          <Route
            exact path="/chat/:room"
            element={
              <Chatpage
                username={username}
                joinRoom={joinRoom}
                activitystatus={activitystatus}
                setActivitystatus={setActivitystatus}
                leftstatus={leftstatus}
                setLeftstatus={setLeftstatus}
                setActiveUsers={setActiveUsers}
              />
            }
          />
          <Route exact path='/Analyze' element={
            <Analyze
              username={username}
              room={room}
              socket={socket}
              activeUsers={activeUsers}
            />
          }
          />
          <Route exact path='/Unauthorized' element={<E_401 />} />
          <Route exact path='/Forbidden' element={<E_403 />} />
          <Route exact path='/Internal-error' element={<E_500 />} />
          <Route exact path='*' element={<E_404 />} />
        </Routes>
      </Router>
    </SocketContext.Provider>
  );
}

export default App;