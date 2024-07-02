import jwt from "jsonwebtoken";
const JWT_SECRET = "secret";

export const generateToken = async (req, res, next) => {
	try {
		let payload;
		if (req.user) {
			payload = { username: req.user.username, room: req.user.room };
		} else {
			payload = {
				username: req.query.username || req.params.username,
				room: req.query.room || req.params.room,
			};
		}

		const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "14m" });
		console.log(token);
		req.token = token;
		next(); // Call the next middleware in the chain
	} catch (error) {
		console.error("Failed to generate token:", error);
		return res.status(500).json({ error: error.message });
	}
};

export const verifyToken = async (req, res, next) => {
	const authorizationHeader = req.headers.authorization;

	if (!authorizationHeader) {
		return res.status(401).json({ message: "No token provided" });
	}

	const token = authorizationHeader.split("Bearer ")[1];

	if (!token) {
		return res.status(401).json({ message: "No token provided" });
	}

	try {
		const decodedToken = jwt.verify(token, JWT_SECRET);
		if (!decodedToken) {
			return res.status(401).json({ message: "Invalid Token" });
		}

		const tokenRoom = decodedToken.room;
		const { username, room } = req.params;

		// First, check if the user is authenticated
		if (decodedToken.username !== username) {
			return res.status(401).json({ message: "Unauthorized: Invalid user" });
		}

		// Then, check if the user has access to the requested room
		if (tokenRoom !== room) {
			return res
				.status(403)
				.json({ message: "Forbidden: You don't have access to this room" });
		}

		// Attach user info to the request object
		req.user = decodedToken;
		next();
	} catch (error) {
		return res.status(401).json({ message: "Failed to authenticate token" });
	}
};
