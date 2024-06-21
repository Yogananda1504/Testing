import React from 'react';
import { Form } from 'react-bootstrap';

function Message({ username, message, isSelectable, isSelected, onSelect }) {
  const messageClass = message.username === username ? 'message-self' : 'message-other';
  const styles ={
    backgroundColor:"#d9fdd3"
  }
  return (
    <div className={`message ${messageClass}`}>

      {message.username !== username && <div className="message-username">{message.username}</div>}
      <div className="message-bubble" >
        {isSelectable && (
          <div className={`message-checkbox ${message.username === username ? 'align-self-end' : 'align-self-start'}`}>
            <Form.Check
              type="checkbox"
              checked={isSelected}
              onChange={() => { onSelect(message.id) }}
              
            />
          </div>
        )}
        {message.message}
      </div>
    </div>
  );
}

export default Message; 