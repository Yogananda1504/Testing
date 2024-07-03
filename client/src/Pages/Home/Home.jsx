import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useContext } from 'react';
import { SocketContext } from '../../../Context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Container, Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import './Home.css';

const apiUrl = 'http://localhost:4000';


const Home = ({ username, setUsername, room, setRoom,  activitystatus, setActivitystatus, leftstatus, setLeftstatus }) => {
    const navigate = useNavigate();
    
    const socket  = useContext(SocketContext);

    const [isJoining, setIsJoining] = useState(false);
    const [isCustomRoom, setIsCustomRoom] = useState(false);
    const [isJoiningExistingRoom, setIsJoiningExistingRoom] = useState(false);

    const generateTokenAndJoinRoom = useCallback(async () => {
        try {
            
            await axios.post(
                `${apiUrl}/api/generate-token?room=${room}&username=${username}`,
                {  },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true, // This enables sending cookies with cross-origin requests
                }
            );
           
           
            socket.emit('join_room', { username, room });
            navigate(`/chat/${room}`);
        } catch (error) {
            console.error('Error generating token:', error);
            toast.error(error.response?.data?.message || 'Error generating token');
        } finally {
            setIsJoining(false);
        }
    }, [apiUrl, navigate, room, socket, username]);

    const checkRoomExists = useCallback(() => {
        return new Promise((resolve) => {
            socket.emit("check_room_exists", room);
            socket.once("room_exists", (exists) => {
                resolve(exists);
            });
        });
    }, [socket, room]);

    const joinRoom = async (e) => {
        e.preventDefault();
        if (isJoining) return;

        if (username.trim() === '' || room.trim() === '') {
            toast.error('Please enter both username and room');
            return;
        }

        setIsJoining(true);

        if (isCustomRoom && isJoiningExistingRoom) {
            const roomExists = await checkRoomExists();
            if (!roomExists) {
                toast.error('The room does not exist');
                setIsJoining(false);
                return;
            }
        }

        socket.emit('check_username', { username, room });
    };

    useEffect(() => {
        const handleUsernameTaken = (isTaken) => {
            if (isTaken) {
                toast.error('Username is already taken');
                setIsJoining(false);
            } else {
                generateTokenAndJoinRoom();
            }
        };

        socket.on('username_taken', handleUsernameTaken);

        return () => {
            socket.off('username_taken', handleUsernameTaken);
        };
    }, [socket, generateTokenAndJoinRoom]);

    useEffect(() => {
        if (!activitystatus) {
            toast.warn('Logged out due to inactivity');
            setActivitystatus(true);
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        }
    }, [activitystatus, setActivitystatus]);

    useEffect(() => {
        if (leftstatus) {
            window.location.reload();
            setLeftstatus(false);
        }
    }, [leftstatus, setLeftstatus]);

    useEffect(() => {
        // Handle reconnection
        const handleReconnect = () => {
            console.log('Reconnected to server');
            const socketId = sessionStorage.getItem('socketId');
            if (socketId) {
                socket.emit('reconnect', { socketId, username, room });
            }
        };

        const handleReconnectionError = (error) => {
            console.error('Socket reconnection error:', error);
            toast.error(`Reconnection error: ${error}`);
        };

        socket.on('reconnect', handleReconnect);
        socket.on('reconnect_error', handleReconnectionError);

        return () => {
            socket.off('reconnect', handleReconnect);
            socket.off('reconnect_error', handleReconnectionError);
        };
    }, [socket, username, room]);

    const handleRoomChange = (e) => {
        const selectedRoom = e.target.value;
        if (selectedRoom === 'custom') {
            setIsCustomRoom(true);
            setIsJoiningExistingRoom(false);
            setRoom('');
        } else if (selectedRoom === 'join_existing') {
            setIsCustomRoom
                (true);
            setIsJoiningExistingRoom(true);
            setRoom('');
        } else {
            setIsCustomRoom(false);
            setIsJoiningExistingRoom(false);
            setRoom(selectedRoom);
        }
    };
    return(
        <div className="home-container">
            <Container className="d-flex flex-column justify-content-center align-items-center min-vh-100">
                <h2 className="mb-4 text-white">{'<>'}DevRooms{'</>'}</h2>
                <Form onSubmit={joinRoom} className="w-100 max-w-400 form-container">
                    <h3 className="text-black mb-3">Enter Your Details</h3>
                    <Form.Group controlId="username" className="mb-3">
                        <Form.Label className="text-white">Username</Form.Label>
                        <Form.Control
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                        />
                    </Form.Group>
                    <Form.Group controlId="room" className="mb-3">
                        <Form.Label className="text-white">Room</Form.Label>
                        <Form.Select
                            value={isCustomRoom ? (isJoiningExistingRoom ? 'join_existing' : 'custom') : room}
                            onChange={handleRoomChange}
                            required
                        >
                            <option value="" disabled>
                                Select Room
                            </option>
                            <option value="custom">Create Custom Room</option>
                            <option value="join_existing">Join Existing Room</option>
                            <option value="MongoDB">MongoDB</option>
                            <option value="NodeJs">NodeJs</option>
                            <option value="ReactJs">ReactJs</option>
                            <option value="JavaScript">JavaScript</option>
                        </Form.Select>
                        {isCustomRoom && (
                            <Form.Control
                                type="text"
                                value={room}
                                onChange={(e) => setRoom(e.target.value)}
                                placeholder={isJoiningExistingRoom ? 'Enter existing room name...' : 'Enter new room name...'}
                                required
                                className="mt-2"
                            />
                        )}
                    </Form.Group>
                    <Button variant="success" type="submit" disabled={isJoining} className="w-100">
                        {isJoining ? 'Joining...' : 'Join Room'}
                    </Button>
                </Form>
                <ToastContainer />
            </Container>
        </div>
    );
};
export default Home;