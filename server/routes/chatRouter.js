import  express from "express";
const router = express.Router();
import getRoomdata from '../controllers/chatController.js';
import  { generateToken,verifyToken } from "../middleware/tokenUtils.js";
import  cors from "cors";

router.use(cors());
// Route for fetching messages and active users in a room
router.use(express.json());

//getRoomdata already has the verification process
router.get("/chat/messages",getRoomdata);
//Generation of Token endpoint
router.post("/generate-token", generateToken, (req, res) => {
	try {
		const token = req.token;
		return res.status(200).json({ token });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});
// Renew token endpoint
router.post("/chat/renew-token", verifyToken, generateToken, (req, res) => {
	try {
		const token = req.token;
		return res.status(200).json({ token });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});



export default router;
