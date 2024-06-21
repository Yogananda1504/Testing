import React, { useEffect, useState, useRef } from 'react';
import { Container } from 'react-bootstrap';
import { useContext } from 'react';
import NavBar from '../../components/NavBar';
import SideDrawer from '../../components/SideDrawer';
import ActivitySection from '../../components/ActivitySection';
import './Chatpage.css';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import 'react-toastify/dist/ReactToastify.css';
import { socket } from '../../../Context/SocketContext';

const apiURL = 'http://localhost:4000';
const INACTIVITY_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes

function Chatpage({ username, activitystatus, setActivitystatus, leftstatus, setLeftstatus }) {
  const [messages, setMessages] = useState([]);
  const { room } = useParams();
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer] = useState(false);
  const inactivityTimerRef = useRef(null);

  const handleDrawerToggle = () => setShowDrawer(!showDrawer);

  const handleLeaveRoom = () => {
    socket.emit('leave_room', { username, room });
    setLeftstatus(true);
    navigate('/');
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      renewToken();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(intervalId);
  }, []);

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
    };
  }, []);

  const renewToken = async () => {
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
  };

  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIME_LIMIT);
  };

  const handleLogout = () => {
    socket.emit('leave_room', { username, room });
    console.log('Logged out due to inactivity');
    setActivitystatus(false);
    sessionStorage.removeItem('token');
    navigate('/');
  };

  useEffect(() => {
    if (!room || !socket) return;

    socket.emit('join', { username, room });

    return () => {
      socket.off('join');
    };
  }, [room, socket, username]);

  useEffect(() => {
    if (!room || !socket) return;

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
  }, [room, socket, navigate, username]);

  useEffect(() => {
    const handleMessages = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    socket.on('chatroom_users', handleUserslist);
    socket.once('welcome_message', (message) => {
      toast.success(message.message);
    });
    socket.once('system_message', (message) => {
      handleMessages(message);
    });

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

  const handleFetchError = (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        navigate('/Forbidden');
      } else if (status === 404) {
        navigate('/Not-found');
      } else if (status === 500) {
        navigate('/Internal-error');
      } else {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch chat data');
      }
    } else {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch chat data');
    }
  };

  const handleUserslist = (users) => {
    setUsers(users);
    console.log(users);
  };

  return (
    <Container fluid className="app-container px-0">
      <NavBar roomName={room} onMenuClick={handleDrawerToggle} onLeaveClick={handleLeaveRoom} />
      <SideDrawer show={showDrawer} onHide={() => setShowDrawer(false)} users={users} />
      <ActivitySection username={username} messages={messages} setMessages={setMessages} socket={socket} room={room} />
      <ToastContainer />
    </Container>
  );
}

export default Chatpage;
