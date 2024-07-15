import Message from "../models/Message.js";
import ActiveUser from "../models/ActiveUser.js";
import Rooms from "../models/Rooms.js";
import { analyzeMoodForUser } from "../Functions/Analyze_User.mjs";
import MoodData from "../models/Mood.js";

const handleSocketEvents = (io) => {
	io.on("connection", (socket) => {
		console.log("New client connected");

		const updateUserActivity = async (username, room) => {
			await ActiveUser.findOneAndUpdate(
				{ username, room },
				{ lastActiveAt: Date.now() },
				{ upsert: true }
			);
		};

		const emitActiveUsers = async (room) => {
			const activeUsersInRoom = await ActiveUser.find({ room });
			io.to(room).emit("chatroom_users", activeUsersInRoom);
		};

		

		socket.on("check_room_exists", async (room) => {
			try {
				const roomExists = await Rooms.exists({ name: room });
				socket.emit("room_exists", !!roomExists);
			} catch (error) {
				console.error("Error checking if room exists:", error);
				socket.emit("room_exists", false);
			}
		});

		socket.on("ping",()=>{
			//Emit the response as pong for the ping 
			socket.emit("pong");
		})

		socket.on("join", async ({ username, room }) => {
			try {
				socket.join(room);
				updateUserActivity(username, room);
			} catch (error) {
				console.error("Error joining room while refreshing:", error);
			}
		});

		socket.on("check_username", async ({ username, room }) => {
			try {
				await Rooms.findOneAndUpdate({ name: room }, {}, { upsert: true });
				const userExists = await ActiveUser.exists({ username, room });
				socket.emit("username_taken", !!userExists);
			} catch (error) {
				console.error("Error checking username:", error);
			}
		});

		socket.on("join_room", async ({ username, room }) => {
			try {
				socket.join(room);
				const now = new Date();
				const newUser = await ActiveUser.create({
					username,
					room,
					lastActiveAt: now,
					createdAt: now,
				});
				await newUser.save();
				//Update the active User count
				await Rooms.updateOne({ room: room }, { $inc: { activeusers: 1 } });
				socket.emit("welcome_message", {
					username: "Admin",
					message: `Welcome ${username} to the room ${room}`,
					id: "-1",
				});
				socket.to(room).emit("system_message", {
					username: "Admin",
					message: `${username} has joined the room`,
					id: "-1",
				});

				await emitActiveUsers(room);
			} catch (error) {
				console.error("Error joining room:", error);
			}
		});
		socket.on("edit_message",async ({ username, room, messageId, newMessage }) => {
				try {
					// Analyze mood for the edited message
					const moodData = await analyzeMoodForUser(newMessage, username, room);

					// Update the message in the database
					const updatedMessage = await Message.findOneAndUpdate(
						{ _id: messageId, username, room },
						{
							message: newMessage,
							edited: true,
							sentimentScore: moodData.sentimentScore, // Add sentiment score to the message
						},
						{ new: true }
					);

					if (updatedMessage) {
						// Update user's mood in ActiveUser
						await ActiveUser.findOneAndUpdate(
							{ username, room },
							{
								$set: {
									lastActiveAt: new Date(),
									mood: moodData.overallMood,
									sentimentScore: moodData.sentimentScore,
								},
							},
							{ new: true, upsert: true }
						);

						// Emit the updated message to all users in the room
						io.to(room).emit("update_edited_message", {
							messageId,
							updatedMessage: updatedMessage.message,
							sentimentScore: moodData.sentimentScore,
						});

						// Optionally, you can emit detailed mood data to the sender
						socket.emit("mood_update", {
							messageId,
							detailedMood: {
								overallMood: moodData.overallMood,
								sentimentScore: moodData.sentimentScore,
								emotionScores: moodData.emotionScores,
								topEmotions: moodData.topEmotions,
								moodDescription: moodData.moodDescription,
							},
						});
					}
				} catch (error) {
					console.error("Error editing message:", error);
					socket.emit("edit_error", { error: "Failed to edit message" });
				}
			}
		);

		socket.on("send_message", async ({ username, message, room }, callback) => {
			const start = performance.now();
			try {
				// Analyze text for sentiment and mood
				const moodData = await analyzeMoodForUser(message, username, room);

				// Create new message
				const newMessage = await Message.create({
					username,
					message,
					room,
					sentimentScore: moodData.sentimentScore,
				});

				// Update user's mood in ActiveUser
				await ActiveUser.findOneAndUpdate(
					{ username, room },
					{
						$set: {
							lastActiveAt: new Date(),
							mood: moodData.overallMood,
							sentimentScore: moodData.sentimentScore,
						},
					},
					{ new: true, upsert: true }
				);

				// Emit the message to all users in the room
				io.to(room).emit("receive_message", {
					username,
					message,
					_id: newMessage._id.toString(),
					sentimentScore: moodData.sentimentScore,
				});

				if (callback) {
					callback(null, {
						id: newMessage._id.toString(),
						message,
						sentimentScore: moodData.sentimentScore,
						detailedMood: {
							overallMood: moodData.overallMood,
							sentimentScore: moodData.sentimentScore,
							emotionScores: moodData.emotionScores,
							topEmotions: moodData.topEmotions,
							moodDescription: moodData.moodDescription,
						},
					});
				}

				const end = performance.now();
				const duration = end - start;
				console.log(
					`Message processing took ${duration.toFixed(
						2
					)}ms for user ${username} in room ${room}`
				);

				if (duration > 1000) {
					console.warn(
						`Message processing exceeded 1000ms (${duration.toFixed(
							2
						)}ms) for user ${username} in room ${room}`
					);
				}
			} catch (error) {
				console.error("Error sending message:", error);
				if (callback) callback(error.message);
			}
		});

		socket.on("delete_for_me", async ({ username, room, messageIds }) => {
			try {
				await Message.updateMany(
					{ _id: { $in: messageIds } },
					{ $addToSet: { deletedForMe: username } }
				);
				await updateUserActivity(username, room);
			} catch (error) {
				console.error("Error marking messages for deletion:", error);
			}
		});

		socket.on("delete_for_everyone", async ({ username, room, messageIds }) => {
			try {
				await Message.updateMany(
					{ _id: { $in: messageIds } },
					{
						message: "This message was deleted",
						deletedForEveryone: true,
						deletedBy: username,
					}
				);
				await updateUserActivity(username, room);
				io.to(room).emit("messages_deleted", { messageIds, username });
			} catch (error) {
				console.error("Error marking messages for deletion:", error);
			}
		});

		socket.on("disconnect", async () => {
			try {
				const user = await ActiveUser.findOneAndDelete({ socketId: socket.id });

				if (user) {
					const { username, room } = user;
					socket.to(room).emit("left_room", {
						username: "Admin",
						message: `${username} has left the room`,
					});
					await emitActiveUsers(room);
				}
			} catch (error) {
				console.error("Error disconnecting:", error);
			}
		});

		socket.on("leave_room", async ({ username, room }) => {
			try {
				await ActiveUser.deleteOne({ username, room });
				await MoodData.deleteOne({ username, room });
				//Decrement the active user count by  1
				await Rooms.updateOne({ room: room }, { $inc: { activeusers: -1 } });
				io.to(room).emit("left_room", {
					username: "Admin",
					message: `${username} has left the room`,
				});
				await emitActiveUsers(room);
				socket.disconnect();
			} catch (error) {
				console.error("Error leaving room:", error);
			}
		});

		socket.on("remove_user", async ({ username, room }) => {
			try {
				await ActiveUser.deleteOne({ username, room });
				await Rooms.updateOne({ room: room }, { $inc: { activeusers: -1 } });
				await MoodData.deleteOne({username,room});
				io.to(room).emit("left_room", {
					username: "Admin",
					message: `${username} has left the room`,
				});
				socket.disconnect();
			} catch (error) {
				console.error("Error leaving room:", error);
			}
		});

		// Error handling events
		["error", "connect_error", "connect_timeout", "reconnect_error"].forEach(
			(event) => {
				socket.on(event, (error) => console.error(`Socket ${event}:`, error));
			}
		);

		socket.on("reconnect", () => {
			console.log("Client reconnected:", socket.id);
		});
	});
};

export default handleSocketEvents;
