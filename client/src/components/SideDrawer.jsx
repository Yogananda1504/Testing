import React, { useState } from 'react';
import { Offcanvas, Form, ListGroup } from 'react-bootstrap';
import './SideDrawer.css';
function SideDrawer({ show, onHide, users }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter((user) => {
        const username = user.username;
        return username.toLowerCase().includes(searchTerm.toLowerCase());
    });
    return (
        <Offcanvas show={show} onHide={onHide} placement="start">
            <Offcanvas.Header closeButton>
                <Offcanvas.Title>Users</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="d-flex flex-column p-0">
                <Form className="p-3" onSubmit={(e) => { e.preventDefault() }}>
                    <Form.Group>
                        <Form.Control
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onSubmit={(e) => e.preventDefault()}
                        />
                    </Form.Group>
                </Form>
                <ListGroup className="flex-grow-1 overflow-auto">
                    {filteredUsers.map((user, index) => (
                        <ListGroup.Item key={index}>{user.username}</ListGroup.Item>
                    ))}
                </ListGroup>
            </Offcanvas.Body>
        </Offcanvas>
    );
}

export default SideDrawer;