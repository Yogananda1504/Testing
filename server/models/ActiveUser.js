import mongoose from "mongoose"; //// Define message model

const ActiveUser = mongoose.model("ActiveUser", {
	username: String,
	room: String,
	lastActiveAt: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now, expires: '2d' },
});




export default ActiveUser;

