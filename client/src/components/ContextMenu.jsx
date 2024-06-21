import React from 'react';
import { Dropdown } from 'react-bootstrap';

function ContextMenu({ show, top, left, onSelect, onClose }) {
  if (!show) return null;

  return (
    <Dropdown.Menu show style={{ position: 'fixed', top, left }}>
      <Dropdown.Item onClick={() => onSelect('select')}>Select</Dropdown.Item>
      <Dropdown.Item onClick={() => onSelect('selectAll')}>Select All</Dropdown.Item>
      <Dropdown.Item onClick={() => onSelect('deselectAll')}>Deselect All</Dropdown.Item>
      <Dropdown.Item onClick={() => onSelect('clearChat')}>Clear Chat</Dropdown.Item>
      <Dropdown.Item onClick={() => onSelect('Analyze')}>Analyze</Dropdown.Item>
    </Dropdown.Menu>
  );
}

export default ContextMenu;