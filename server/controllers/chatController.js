import express from "express";
import Message from "../models/Message.js";
import ActiveUser from "../models/ActiveUser.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = "secret";

const getRoomdata = async (req, res) => {
  const { room, username } = req.query;

  try {
    // Ensure authorization header is present
    if (!req.headers.authorization) {
      console.log("Authorization header missing for user:", username);
      return res.status(401).json({ message: "Authorization header missing" });
    }

    // Extract token
    const token = req.headers.authorization.split("Bearer ")[1];
    if (!token) {
      console.log("Token missing for user:", username);
      return res.status(401).json({ message: "Token missing" });
    }

    // Verify token
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      console.log("Invalid token for user:", username, "Error:", jwtError.message);
      return res.status(401).json({ message: "Invalid token" });
    }

    // Check if the user is authorized for this room
    if (decodedToken.username !== username) {
      console.log(`Unauthorized: Token username (${decodedToken.username}) does not match request username (${username})`);
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    // Check if the user has access to the requested room
    if (decodedToken.room !== room) {
      console.log(`Forbidden: User ${username} attempted to access unauthorized room ${room}`);
      return res.status(403).json({ message: "Forbidden: You don't have access to this room" });
    }

    // Fetch messages and active users
    const messages = await Message.find({
      room,
      deletedForMe: { $nin: [username] },
    }).sort({ createdAt: 1 }).exec();

    const activeUsersInRoom = await ActiveUser.find({ room }).exec();

    // Respond with messages and active users
    res.json({ Messages: messages, users: activeUsersInRoom });

  } catch (error) {
    console.error("Error in getRoomdata:", error);
    res.status(500).json({ message: "An internal server error occurred" });
  }
};

export default getRoomdata;