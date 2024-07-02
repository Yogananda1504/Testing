import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Container } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import axios from 'axios';
import NavBar from '../../components/NavBar';
import SideDrawer from '../../components/SideDrawer';
import ActivitySection from '../../components/ActivitySection';
import InactivityPopup from '../../components/InactivityPopup';
import { socket } from '../../../Context/SocketContext';
import './Chatpage.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

const apiURL = 'http://localhost:4000';
const INACTIVITY_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes
const TOKEN_RENEWAL_INTERVAL = 14 * 60 * 1000; // 14 minutes
const INACTIVITY_WARNING_TIME = 1 * 60 * 1000; // 1 minute

function Chatpage({ username, setActivitystatus, setLeftstatus }) {
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

  const handleDrawerToggle = () => setShowDrawer(!showDrawer);

  const handleLeaveRoom = useCallback(() => {
    socket.emit('leave_room', { username, room });
    setLeftstatus(true);
    navigate('/');
  }, [username, room, setLeftstatus, navigate]);

  const renewToken = useCallback(async () => {
    try {
      const response = await axios.post(
        `${apiURL}/api/chat/renew-token`,
        { username, room },
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('token')}`,
          },
        }
      );
      sessionStorage.setItem('token', response.data.token);
      toast.success('Token renewed successfully');
    } catch (error) {
      console.error('Failed to renew token:', error);
      toast.error('Failed to renew token.');
      navigate('/');
    }
  }, [username, room, navigate]);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimerRef.current);
    clearTimeout(inactivityWarningTimerRef.current);
    clearTimeout(tokenRenewalTimerRef.current);

    lastActivityRef.current = Date.now();

    inactivityWarningTimerRef.current = setTimeout(() => {
      setShowInactivityPopup(true);
    }, INACTIVITY_TIME_LIMIT - INACTIVITY_WARNING_TIME);

    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIME_LIMIT);

    tokenRenewalTimerRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity < TOKEN_RENEWAL_INTERVAL) {
        renewToken();
      }
    }, TOKEN_RENEWAL_INTERVAL);
  }, [renewToken]);

  const handleStayActive = useCallback(() => {
    setShowInactivityPopup(false);
    resetInactivityTimer();
    renewToken();
  }, [resetInactivityTimer, renewToken]);

  const handleLogout = useCallback(() => {
    socket.emit('leave_room', { username, room });
    console.log('Logged out due to inactivity');
    setActivitystatus(false);
    sessionStorage.removeItem('token');
    navigate('/');
  }, [username, room, setActivitystatus, navigate]);

  const handleFetchError = useCallback((error) => {
    console.error('Error details:', error);

    if (!error.response) {
      console.error('Network error or no response from server');
      toast.error('Network error. Please check your connection.');
      return;
    }

    const { status, data } = error.response;
    const { message } = data;

    console.log(`Error ${status}: ${message}`, { username, room });

    switch (status) {
      case 401:
        console.log(`Unauthorized: ${message}. Removing user ${username} from room ${room}`);
        socket.emit("remove_user", { username, room });
        navigate('/Unauthorized', { state: { errorMsg: message } });
        break;
      case 403:
        console.log("Forbidden: Improper access to the room");
        navigate('/Forbidden');
        break;
      case 404:
        console.log("Not Found: Requested resource not available");
        navigate('/Not-found');
        break;
      case 500:
        console.log(`Internal Server Error: ${message}`);
        socket.emit("remove_user", { username, room });
        navigate('/Internal-error', { state: { errorMsg: message } });
        break;
      default:
        console.log(`Unhandled error status ${status}: ${message}`);
        toast.error('Failed to fetch chat data');
        navigate('/error');
    }
  }, [username, room, navigate]);

  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearTimeout(inactivityTimerRef.current);
      clearTimeout(inactivityWarningTimerRef.current);
      clearTimeout(tokenRenewalTimerRef.current);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!room || !socket) return;

    socket.emit('join', { username, room });

    const fetchData = async () => {
      try {
        const res = await axios.get(
          `${apiURL}/api/chat/messages?room=${room}&username=${username}`,
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('token')}`,
            },
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
      console.log(users);
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
      console.error('Socket reconnection error:', error);
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
      <NavBar roomName={room} onMenuClick={handleDrawerToggle} onLeaveClick={handleLeaveRoom} />
      <SideDrawer show={showDrawer} onHide={() => setShowDrawer(false)} users={users} />
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