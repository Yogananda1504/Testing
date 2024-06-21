import  express from "express";
const router = express.Router();
import Message from "../models/Message.js";
import ActiveUser from "../models/ActiveUser.js";
import  jwt from "jsonwebtoken"; // Corrected import name
const JWT_SECRET = "secret";

const getRoomdata = async (req, res) => {
	const room = req.query.room;
	const username = req.query.username;

	try {
		// Ensure authorization header is present
		if (!req.headers.authorization) {
			return res.status(401).json({ error: "Authorization header missing" });
		}

		// Extract token
		const token = req.headers.authorization.split("Bearer ")[1];
		if (!token) {
			return res.status(401).json({ error: "Token missing" });
		}

		// Verify token
		const decodedToken = jwt.verify(token, JWT_SECRET);
		const token_room = decodedToken.room;
		if (token_room !== room) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// Fetch messages and active users
		const messages = await Message.find({
			room,
			deletedForMe: { $nin: [username] },
		})
			.sort({ createdAt: 1 })
			.exec();

		const activeUsersInRoom = await ActiveUser.find({ room }).exec();

		// Respond with messages and active users
		res.json({ Messages: messages, users: activeUsersInRoom });
	} catch (error) {
		console.error("Error fetching data for room:", room, "Error:", error);
		res
			.status(500)
			.json({
				error: "An error occurred while fetching data for room: " + room,
			});
	}
};

export default getRoomdata;
