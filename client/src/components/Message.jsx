import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import { ChevronDown } from 'lucide-react';

const Message = ({
  username,
  message,
  isSelectable,
  isSelected,
  onSelect,
  onMessageOptions
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOwnMessage = message.username === username;
  const messageClass = isOwnMessage ? 'message-self' : 'message-other';

  const renderMessageContent = () => {
    if (message.deletedForEveryone) {
      return message.deletedBy === username
        ? "You deleted this message"
        : `${message.deletedBy} deleted this message for everyone`;
    }
    return message.message;
  };

  const renderUsername = () => {
    if (message.username === username) {
      return "You";
    }
    return message.username;
  };

  const handleOptionsClick = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    onMessageOptions(e, message._id, isOwnMessage);
  };

  return (
    <div
      className={`message ${messageClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="message-username">{renderUsername()}</div>
      <div className="message-bubble" style={{ backgroundColor: "#d9fdd3", color: "black", position: 'relative' }}>
        {isSelectable && (
          <Form.Check
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(message._id)}
            className={`message-checkbox ${isOwnMessage ? 'align-self-end' : 'align-self-start'}`}
          />
        )}
        {renderMessageContent()}
        {isHovered && (
          <div
            className="message-options"
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              cursor: 'pointer'
            }}
            onClick={handleOptionsClick}
          >
            <ChevronDown size={16} color="#666" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;