import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Modal } from 'react-bootstrap';
import Message from './Message';
import ContextMenu from './ContextMenu';
import { socket } from '../../Context/SocketContext';

function ActivitySection({ username, messages, setMessages, room }) {
  const [newMessage, setNewMessage] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, top: 0, left: 0 });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hasScrolledUp, setHasScrolledUp] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const messageDisplayRef = useRef(null);

  const style_for_option_container = {
    paddingBottom: "0.5rem",
    paddingTop: "0.5rem",
    fontSize: "2rem",
  }

  const style_for_scroll_bottom = {


    padding: "1rem",
    fontSize: "2rem",

    zIndex: 100000,
    position: "fixed",
    bottom: "5rem",
    left: "50%",
    transform: "translateX(-50%)",
    border: "0.3rem solid white",
    borderRadius: "50%",
    cursor: "pointer",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    width: "5rem",
    height: "5rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  };

  useEffect(() => {
    const messageDisplay = messageDisplayRef.current;
    if (messageDisplay) {
      const handleScroll = () => {
        setTimeout(() => {
          const { scrollTop, scrollHeight, clientHeight } = messageDisplay;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
          setHasScrolledUp(!isAtBottom);
        }, 100);
      };

      messageDisplay.addEventListener('scroll', handleScroll);
      return () => messageDisplay.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    const messageDisplay = messageDisplayRef.current;
    if (messageDisplay && !hasScrolledUp) {
      messageDisplay.scrollTo({ top: messageDisplay.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, hasScrolledUp]);

  useEffect(() => {
    socket.on("receive_message", handleMessageReceive);
    socket.on('messages_deleted', handleMessagesDeleted);
    socket.on('left_room',(data)=>{
      handleMessageReceive(data);
    })
    return () => {
      socket.off("receive_message", handleMessageReceive);
      socket.off('messages_deleted', handleMessagesDeleted);
      socket.off('left_room');
    }
  }, [socket]);

  const handleMessageSend = (e) => {
    e.preventDefault();
    if (newMessage.trim() !== '') {
      const msgdata = {
        username: username,
        message: newMessage,
        room: room
      }
      socket.emit("send_message", msgdata);
      setNewMessage('');
    }
  };

  const handleMessageReceive = (data) => {
    setMessages((prevMessages) => [...prevMessages, data]);
  }

  const handleMessagesDeleted = ({ messageIds, username }) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        messageIds.includes(msg._id)
          ? { ...msg, message: msg.username === username ? 'You Deleted the Message' : `${msg.username} deleted the  message`, deletedForEveryone: true, deletedBy: username }
          : msg
      )
    );
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ show: true, top: e.clientY, left: e.clientX });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(prevMode => {
      if (!prevMode) {
        // Entering selection mode
        return true;
      } else {
        // Exiting selection mode, clear selections
        setSelectedMessages([]);
        return false;
      }
    });
  };

  const handleSelectMessage = (messageId) => {
    setSelectedMessages(prevSelected => {
      const newSelected = prevSelected.includes(messageId)
        ? prevSelected.filter(id => id !== messageId)
        : [...prevSelected, messageId];
      console.log("Updated selected messages:", newSelected);
      return newSelected;
    });
  };

  const handleClearChat = () => {
    socket.emit('delete_for_me', { username, messageIds: messages.map(msg => msg._id) });
    setMessages([]);
  }

  const handleSelectAll = () => {
    const allMessageIds = messages.map(msg => msg._id);
    setSelectedMessages(allMessageIds);
    setSelectionMode(true);
    console.log("Selected all messages:", allMessageIds);
  };

  const handleDeselectAll = () => {
    setSelectedMessages([]);
    setSelectionMode(false);
    console.log("Deselected all messages");
  };


  const handleSelectOption = (option) => {
    switch (option) {
      case 'select':
        if (!selectionMode) toggleSelectionMode();
        break;
      case 'selectAll':
        handleSelectAll();
        break;
      case 'deselectAll':
        handleDeselectAll();
        break;
      case 'clearChat':
        handleClearChat();
        break;
      default:
        break;
    }
    setContextMenu({ show: false, top: 0, left: 0 });
  };

  const handleDeleteMessages = () => {
    console.log("Delete button clicked");
    console.log("Selected messages:", selectedMessages);

    if (selectedMessages.length === 0) {
      console.log("No messages selected");
      return;
    }

    let hasSentByMe = false;
    let hasNotSentByMe = false;

    selectedMessages.forEach(id => {
      const message = messages.find((msg, _) => msg._id === id);
      if (message.username === username) {
        hasSentByMe = true;
      } else {
        hasNotSentByMe = true;
      }
    });

    if (hasSentByMe && hasNotSentByMe) {
      setDeleteType('both');
    } else if (hasSentByMe) {
      setDeleteType('sentByMe');
    } else {
      setDeleteType('notSentByMe');
    }
    console.log("Delete type:", deleteType);
    console.log("Setting showDeleteModal to true");
    setShowDeleteModal(true);
  };

  const confirmDelete = async (deleteFor) => {
    try {
      if (selectedMessages.length === 0) return;

      const messagesToDelete = selectedMessages; // No need to map, as we're already storing _id

      if (deleteFor === 'me') {
        socket.emit('delete_for_me', { username, messageIds: messagesToDelete });
        const updatedMessages = messages.filter(msg => !selectedMessages.includes(msg._id));
        setMessages(updatedMessages);
      } else if (deleteFor === 'everyone') {
        const messagesToDeleteForEveryone = messagesToDelete.filter(id =>
          messages.find(msg => msg._id === id).username === username
        );
        socket.emit('delete_for_everyone', { username, room, messageIds: messagesToDeleteForEveryone });
      }

      setSelectedMessages([]);
      setSelectionMode(false);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting messages:', error);
    }
  };

  return (
    <Container
      fluid
      className="activity-section"
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenu({ show: false, top: 0, left: 0 })}
    >
      <Row className="message-display-section position-relative" ref={messageDisplayRef}>
        <Col>
          {messages.map((message) => (
            <Message
              key={message._id}
              username={username}
              message={message}
              isSelectable={selectionMode}
              isSelected={selectedMessages.includes(message._id)}
              onSelect={() => handleSelectMessage(message._id)}
            />
          ))}

        </Col>
      </Row>
      {hasScrolledUp && (

        <span
          className="scroll-to-bottom material-symbols-outlined"
          onClick={() => {
            messageDisplayRef.current.scrollTo({ top: messageDisplayRef.current.scrollHeight, behavior: 'smooth' });
            setHasScrolledUp(false);
          }}
          style={style_for_scroll_bottom}
        >

          expand_circle_down

        </span>

      )}
      {selectionMode ? (
        <Row className="option-container" style={style_for_option_container}>
          <Col xs="auto">
            <Button variant="link" onClick={toggleSelectionMode} title='Close'>
              <span className="material-symbols-outlined">
                close
              </span>
            </Button>
          </Col>
          <Col xs="auto">
            <Button variant="link" onClick={handleSelectAll} title='SelectAll'>
              <span class="material-symbols-outlined">
                select_all
              </span>
            </Button>
          </Col>
          <Col xs="auto">
            <Button variant="link" onClick={handleDeselectAll} title='DeSelectAll'>
              <span class="material-symbols-outlined">
                deselect
              </span>
            </Button>
          </Col>
          <Col xs="auto" className="ms-auto">
            <Button
              variant="link"
              onClick={() => {
                setShowDeleteModal(true);
                handleDeleteMessages();
              }}
              disabled={selectedMessages.length === 0}
              title='Delete Messages'
            >
              <span class="material-symbols-outlined" title='delete' style={{color:"Red",}}>
                delete
              </span>
            </Button>
          </Col>
        </Row>
      ) : (
        <Row className="input-container">
          <Col>
            <Form onSubmit={handleMessageSend}>
              <Form.Group className="d-flex">
                <Form.Control
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button
                  variant="success"
                  type="submit"
                  className="d-flex justify-content-center align-items-center"
                >
                  <span class="material-symbols-outlined">
                    send
                  </span>
                </Button>
              </Form.Group>
            </Form>
          </Col>
        </Row>
      )}
      <ContextMenu
        show={contextMenu.show}
        top={contextMenu.top}
        left={contextMenu.left}
        onSelect={handleSelectOption}
        onClose={() => setContextMenu({ show: false, top: 0, left: 0 })}
      />

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Messages</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete the selected messages?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => confirmDelete('me')}>
            Delete for Me
          </Button>
          {(deleteType === 'sentByMe' ) && (
            <Button variant="danger" onClick={() => confirmDelete('everyone')}>
              Delete for Everyone
            </Button>
          )}
        </Modal.Footer>
      </Modal>



    </Container>
  );
}

export default ActivitySection;