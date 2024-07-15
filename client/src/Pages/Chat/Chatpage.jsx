// eslint-disable-next-line no-unused-vars

import React, { useEffect, useContext,useState, useRef, useCallback } from 'react';
import { Container } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import axios from 'axios';
import NavBar from '../../components/NavBar';
import SideDrawer from '../../components/SideDrawer';
import ActivitySection from '../../components/ActivitySection';
import InactivityPopup from '../../components/InactivityPopup';
import { socket } from '../../../Context/SocketContext';
import { ActiveUserContext } from '../../../Context/ActiveUserContext';
import './Chatpage.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

const apiURL = 'http://localhost:4000';
const INACTIVITY_TIME_LIMIT =  15 *60 * 1000; // 15 m 
const TOKEN_RENEWAL_INTERVAL = 14 *60 * 1000; //  14 m 
const INACTIVITY_WARNING_TIME = 60* 1000; // 1 m 
// eslint-disable-next-line react/prop-types
function Chatpage({ username, setActivitystatus, setLeftstatus,isConnected}) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showInactivityPopup, setShowInactivityPopup] = useState(false);
  const { room } = useParams();
  const navigate = useNavigate();
  const inactivityTimerRef = useRef(null);
  const inactivityWarningTimerRef = useRef(null);
  const tokenRenewalTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const { setActiveUsers } = useContext(ActiveUserContext)

  const handleDrawerToggle = () => setShowDrawer(!showDrawer);

  const renewToken = useCallback(async () => {
    socket.emit("update_activity", { username, room, time: Date.now() });
    try {
      // Assuming token is stored in localStorage
      const response = await axios.post(
        `${apiURL}/api/chat/renew-token?room=${room}&username=${username}`,
        {},
        {
          headers: {

          },
          withCredentials: true,
        }
      );
      toast.success('Token renewed successfully');
      return true;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(error.response.data.message)
        // Handle unauthorized error specifically
        toast.error('Session expired. Please log in again.');
        handleLogout(); // Log out the user
      } else {
        toast.error('Failed to renew token.');
      }
      return false;
    }
  }, [username, room]);




  const handleLogout = useCallback(async () => {
    try {
      socket.emit('leave_room', { username, room });
      setActivitystatus(false);
      await axios.delete(`${apiURL}/api/chat/logout`,
        { data: { username, room } },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true
        }
      );
      navigate('/');
    } catch (error) {
      toast.error('Failed to logout. Please try again.');
      navigate('/');
    }
  }, [username, room, setActivitystatus, navigate]);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimerRef.current);
    clearTimeout(inactivityWarningTimerRef.current);

    lastActivityRef.current = Date.now();

    inactivityWarningTimerRef.current = setTimeout(() => {
      setShowInactivityPopup(true);
    }, INACTIVITY_TIME_LIMIT - INACTIVITY_WARNING_TIME);

    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIME_LIMIT);
  }, [handleLogout]);

  const startTokenRenewalTimer = useCallback(() => {
    clearInterval(tokenRenewalTimerRef.current);

    tokenRenewalTimerRef.current = setInterval(async () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity < TOKEN_RENEWAL_INTERVAL) {
        const tokenRenewed = await renewToken();
        if (tokenRenewed) {
          resetInactivityTimer();
        }
      }
    }, TOKEN_RENEWAL_INTERVAL);
  }, [renewToken, resetInactivityTimer]);

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    resetInactivityTimer();

    const timeSinceLastTokenRenewal = Date.now() - (tokenRenewalTimerRef.current ? tokenRenewalTimerRef.current._idleStart : 0);
    if (timeSinceLastTokenRenewal >= TOKEN_RENEWAL_INTERVAL) {
      renewToken().then((tokenRenewed) => {
        if (tokenRenewed) {
          resetInactivityTimer();
        }
      });
    }
  }, [resetInactivityTimer, renewToken]);

  const handleStayActive = useCallback(async () => {
    setShowInactivityPopup(false);
    const tokenRenewed = await renewToken();

    if (tokenRenewed) {
      resetInactivityTimer();
    } else {
      handleLogout();
    }
  }, [resetInactivityTimer, renewToken, handleLogout]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      socket.emit('leave_room', { username, room });
      await axios.delete(`${apiURL}/api/chat/logout`,
        { data: { username, room } },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true
        }
      );
      setLeftstatus(true);
      navigate('/');
    } catch (error) {
      toast.error('Failed to leave room. Please try again.');
      navigate('/');
    }
  }, [username, room, setLeftstatus, navigate]);

  const handleFetchError = useCallback((error) => {
    if (!error.response) {
      toast.error('Network error. Please check your connection.');
      return;
    }

    const { status, data } = error.response;
    const { message } = data;

    switch (status) {
      case 401:
        socket.emit("remove_user", { username, room });
        navigate('/Unauthorized', { state: { errorMsg: message } });
        break;
      case 403:
        navigate('/Forbidden');
        break;
      case 404:
        navigate('/Not-found');
        break;
      case 500:
        socket.emit("remove_user", { username, room });
        navigate('/Internal-error', { state: { errorMsg: message } });
        break;
      default:
        toast.error('Failed to fetch chat data');
        navigate('/error');
    }
  }, [username, room, navigate]);

  // useEffect(() => {
  //   if (users.length > 0) {
  //     setActiveUsers(users);
  //   }
  // }, [users, setActiveUsers]);

  useEffect(() => {
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    resetInactivityTimer();
    startTokenRenewalTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearTimeout(inactivityTimerRef.current);
      clearTimeout(inactivityWarningTimerRef.current);
      clearInterval(tokenRenewalTimerRef.current);
    };
  }, [resetInactivityTimer, startTokenRenewalTimer, handleActivity]);

  useEffect(() => {
    if (!room || !socket) return;

    socket.emit('join', { username, room });

    const fetchData = async () => {
      try {
        const res = await axios.get(
          `${apiURL}/api/chat/messages?room=${room}&username=${username}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            withCredentials: true
          }
        );

        setMessages(res.data.Messages);
        setUsers(res.data.users);
      } catch (error) {
        handleFetchError(error);
      }
    };

    fetchData();

    return () => {
      socket.off('join');
    };
  }, [room, socket, username, handleFetchError]);

  useEffect(() => {
    const handleMessages = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserslist = (users) => {
      setUsers(users);
      setActiveUsers(users);
    };

    socket.on('chatroom_users', handleUserslist);
    socket.once('welcome_message', (message) => {
      toast.success(message.message);
    });
    socket.once('system_message', handleMessages);

    socket.on('reconnect', () => {
      const socketId = sessionStorage.getItem('socketId');
      if (socketId) {
        socket.emit('reconnected', { socketId, username, room });
      }
    });

    socket.on('reconnect_error', (error) => {
      toast.error(`Reconnection error: ${error}`);
    });



    return () => {
      socket.off('chatroom_users', handleUserslist);
      socket.off('welcome_message');
      socket.off('system_message');
      socket.off('reconnect');
      socket.off('reconnect_error');
    };
  }, [socket, username, room]);

  return (
    <Container fluid className="app-container px-0">
      <NavBar roomName={room} onMenuClick={handleDrawerToggle} onLeaveClick={handleLeaveRoom} socket={socket} />
      <SideDrawer show={showDrawer} isConnected={isConnected} onHide={() => setShowDrawer(false)} users={users} />
      <ActivitySection username={username} messages={messages} setMessages={setMessages} socket={socket} room={room} />
      <InactivityPopup
        show={showInactivityPopup}
        onStayActive={handleStayActive}
        onLogout={handleLogout}
      />
      <ToastContainer />
    </Container>
  );
}

export default Chatpage;
