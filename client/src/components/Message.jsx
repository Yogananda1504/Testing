import React from 'react';
import { Form } from 'react-bootstrap';

const Message = ({
  username,
  message,
  isSelectable,
  isSelected,
  onSelect
}) => {
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

  const renderUsername=()=>{
    if(message.username===username){
      return "You";
    }
    return message.username;
  }

  return (
    <div className={`message ${messageClass}`}>
       <div className="message-username">{renderUsername()}</div>
      <div className="message-bubble" style={{ backgroundColor: "#d9fdd3",color:"black" }}>
        {isSelectable && (
          <Form.Check
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(message.id)}
            className={`message-checkbox ${isOwnMessage ? 'align-self-end' : 'align-self-start'}`}
          />
        )}
        {renderMessageContent()}
      </div>
    </div>
  );
};

export default Message;