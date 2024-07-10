import express from "express";
const router = express.Router();
import getRoomdata from "../controllers/chatController.js";
import {
	generateToken,
	verifyAccessToken,
	CrossValidateRefreshToken,
} from "../middleware/tokenUtils.js";
import cors from "cors";
import {
	verifyRefreshToken,
	generateAccessteToken,
} from "../middleware/tokenUtils.js";

let config = {
	origin: [
		"http://localhost:5173",
		"https://jr87x084-5173.inc1.devtunnels.ms",
		
	],
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization","Cookie"],
	credentials: true,
};

router.use(cors(config));
// Route for fetching messages and active users in a room
router.use(express.json());

//getRoomdata already has the verification process
router.get(
	"/chat/messages",
	CrossValidateRefreshToken,
	verifyAccessToken,
	getRoomdata
);
//Generation of Token endpoint
router.post("/generate-token", generateToken, (req, res) => {
	try {
		return res.status(200).json({ message: "Token generated successfully" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});
// Renew token endpoint
router.post(
	"/chat/renew-token",
	CrossValidateRefreshToken,
	verifyRefreshToken,
	generateAccessteToken,
	(req, res) => {
		try {
			return res.status(200).json({ message: "Token renewed successfully" });
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	}
);

router.delete(
	"/chat/logout",
	CrossValidateRefreshToken,
	verifyAccessToken,
	(req, res) => {
		//We are going to delete the tokens from the database as well as clearing them
		const RefreshToken = req.cookies.refreshToken;
		if (!RefreshToken) {
			return res.status(401).json({ error: "No refresh token found" });
		}
		//Find it in the database and delete it
		//Then clear the cookies
		RefreshToken.findOneAndDelete(
			{ refreshToken: RefreshToken },
			(err, doc) => {
				if (err) {
					return res.status(500).json({ error: err.message });
				}
				return res.status(200).json({ message: "Logout successful" });
			}
		);

		//Now clear the cookies
		res.clearCookie("accessToken");
		res.clearCookie("refreshToken");
	}
);

export default router;
