import React from 'react';
import { Navbar, Container, Button } from 'react-bootstrap';

const style_for_menu = {
  cursor: 'pointer',
  fontSize: '24px',
  color: 'white'
};

function NavBar({ roomName, onMenuClick, onLeaveClick }) {
  return (
    <Navbar bg="dark" variant="dark">
      <Container fluid>
        <span
          className="material-symbols-outlined"
          onClick={onMenuClick}
          style={style_for_menu}
        >
          menu
        </span>
        <Navbar.Brand>
          <span>{roomName}</span>
        </Navbar.Brand>
        <Button variant="outline-danger" onClick={onLeaveClick}>
          Leave
        </Button>
      </Container>
    </Navbar>
  );
}

export default NavBar;