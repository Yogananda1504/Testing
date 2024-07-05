import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Modal } from 'react-bootstrap';
import Message from './Message';
import ContextMenu from './ContextMenu';
import { socket } from '../../Context/SocketContext';

function ActivitySection({ username, messages, setMessages, room }) {
  const [newMessage, setNewMessage] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, msgoptions: false, top: 0, left: 0, messageId: null, isOwnMessage: false });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hasScrolledUp, setHasScrolledUp] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [to_be_edited, setTo_be_edited] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const messageDisplayRef = useRef(null);

  const style_for_option_container = {
    paddingBottom: "0.5rem",
    paddingTop: "0.5rem",
    fontSize: "2rem",
  };

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
    socket.on('left_room', (data) => {
      handleMessageReceive(data);
    });

    return () => {
      socket.off("receive_message", handleMessageReceive);
      socket.off('messages_deleted', handleMessagesDeleted);
      socket.off('update_edited_message');
      socket.off('left_room');
    }
  }, [socket]);


  // useEffect(() => {


  //   socket.on("update_edited_message", handleEditedMessage);

  //   return () => {
  //     socket.off('update_edited_message', handleEditedMessage);
  //   };
  // }, [socket]);

  const handleMessageSend = (e) => {
    e.preventDefault();
    if (newMessage.trim() !== '') {
      const msgdata = {
        username: username,
        message: newMessage,
        room: room
      };
      socket.emit("send_message", msgdata);
      socket.emit("update_activity", { username, room, time: Date.now() })
      setNewMessage('');
    }
  };

  // const handleEditedMessage = (data) => {
  //   console.log("Received edited message:", data);
  //   //data has messageId, and editedMessage object
  //   setMessages(prevMessages =>
  //     prevMessages.map(msg =>
  //       msg._id === data.messageId
  //         ? { ...msg, message: data.editedMessage }
  //         : msg
  //     )
  //   );

  // };
  


  const handleMessageReceive = (data) => {
    setMessages((prevMessages) => [...prevMessages, data]);
  };

  const handleMessagesDeleted = ({ messageIds, username }) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        messageIds.includes(msg._id)
          ? { ...msg, message: msg.username === username ? 'You Deleted the Message' : `${msg.username} deleted the message`, deletedForEveryone: true, deletedBy: username }
          : msg
      )
    );
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ show: true, msgoptions: false, top: e.clientY, left: e.clientX, messageId: null, isOwnMessage: false });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(prevMode => {
      if (!prevMode) {
        return true;
      } else {
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
    socket.emit('delete_for_me', { username, room, messageIds: messages.map(msg => msg._id) });
    setMessages([]);
  };

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

  const handleEditMessage = (messageId) => {
    console.log(`Editing message with ID: ${messageId}`);
    const message = messages.find(msg => msg._id === messageId);
    setTo_be_edited(message.message);
    setEditedMessage(message.message);
    setEditingMessageId(messageId);
    setShowEditModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editedMessage.trim() === '') {
      return;
    }
    socket.emit('edit_message', { username, room, messageId: editingMessageId, newMessage: editedMessage });
    setMessages(prevMessages =>
      prevMessages.map((msg) =>
        msg._id === editingMessageId
          ? { ...msg, message: editedMessage }
          : msg
      )
    );
    setShowEditModal(false);
    setEditingMessageId(null);
    setEditedMessage('');
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
      case 'edit':
        handleEditMessage(contextMenu.messageId);
        break;
      case 'delete':
        handleDeleteMessages([contextMenu.messageId]);
        break;
      default:
        break;
    }
    setContextMenu({ show: false, msgoptions: false, top: 0, left: 0, messageId: null, isOwnMessage: false });
  };

  const handleDeleteMessages = (messagesToDelete = selectedMessages) => {
    console.log("Delete button clicked");
    console.log("Selected messages:", messagesToDelete);

    if (messagesToDelete.length === 0) {
      console.log("No messages selected");
      return;
    }

    let hasSentByMe = false;
    let hasNotSentByMe = false;

    messagesToDelete.forEach(id => {
      const message = messages.find(msg => msg._id === id);
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

    setSelectedMessages(messagesToDelete);
    setShowDeleteModal(true);
  };

  const confirmDelete = async (deleteFor) => {
    try {
      if (selectedMessages.length === 0) return;

      const messagesToDelete = selectedMessages;

      if (deleteFor === 'me') {
        socket.emit('delete_for_me', { username, messageIds: messagesToDelete });
        socket.emit("update_activity", { username, room, time: Date.now() });
        const updatedMessages = messages.filter(msg => !selectedMessages.includes(msg._id));
        setMessages(updatedMessages);
      } else if (deleteFor === 'everyone') {
        const messagesToDeleteForEveryone = messagesToDelete.filter(id =>
          messages.find(msg => msg._id === id).username === username
        );
        socket.emit('delete_for_everyone', { username, room, messageIds: messagesToDeleteForEveryone });
        socket.emit("update_activity", { username, room, time: Date.now() });
      }

      setSelectedMessages([]);
      setSelectionMode(false);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting messages:', error);
    }
  };

  const handleMessageOptions = (e, messageId, isOwnMessage) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = messageDisplayRef.current.getBoundingClientRect();

    let left = e.clientX;
    let top = e.clientY;

    if (isOwnMessage) {
      left = rect.left - 150;
    }

    left = Math.max(left, containerRect.left);

    const maxLeft = containerRect.right - 150;
    left = Math.min(left, maxLeft);

    setContextMenu({
      show: true,
      msgoptions: true,
      top,
      left,
      messageId,
      isOwnMessage
    });
  };

  return (
    <Container
      fluid
      className="activity-section"
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenu({ show: false, msgoptions: false, top: 0, left: 0, messageId: null, isOwnMessage: false })}
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
              onMessageOptions={handleMessageOptions}
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
              <span className="material-symbols-outlined">
                select_all
              </span>
            </Button>
          </Col>
          <Col xs="auto">
            <Button variant="link" onClick={handleDeselectAll} title='DeSelectAll'>
              <span className="material-symbols-outlined">
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
              <span className="material-symbols-outlined" title='delete' style={{ color: "Red" }}>
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
                  <span className="material-symbols-outlined">
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
        msgoptions={contextMenu.msgoptions}
        top={contextMenu.top}
        left={contextMenu.left}
        onSelect={handleSelectOption}
        onClose={() => setContextMenu({ show: false, msgoptions: false, top: 0, left: 0, messageId: null, isOwnMessage: false })}
        hasSentByMe={contextMenu.isOwnMessage}
        messageId={contextMenu.messageId}
        containerRef={messageDisplayRef}
      />
      <Modal show={showEditModal} onHide={() => {
        setShowEditModal(false);
        setEditingMessageId(null);
        setEditedMessage('');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Message</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Previous Message:</Form.Label>
              <Form.Text className="d-block mb-2">{to_be_edited}</Form.Text>
              <Form.Label>Enter New Message:</Form.Label>
              <Form.Control
                type="text"
                placeholder="Type your new message..."
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                autoFocus
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowEditModal(false);
              setEditingMessageId(null);
              setEditedMessage('');
            }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

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
          {(deleteType === 'sentByMe' || deleteType === 'both') && (
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