import Message from "../models/Message.js";
import ActiveUser from "../models/ActiveUser.js";
import Rooms from "../models/Rooms.js";
import vaderSentiment from "vader-sentiment";

function getMood(score) {
    if (score <= -0.6) return "very negative";
    if (score <= -0.2) return "negative";
    if (score < 0.2) return "neutral";
    if (score < 0.6) return "positive";
    return "very positive";
}

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

        socket.on("join", async ({ username, room }) => {
            socket.join(room);
            await updateUserActivity(username, room);
        });

        socket.on("check_room_exists", async (room) => {
            try {
                const roomExists = await Rooms.exists({ name: room });
                socket.emit("room_exists", !!roomExists);
            } catch (error) {
                console.error("Error checking if room exists:", error);
                socket.emit("room_exists", false);
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
                const newUser = await ActiveUser.create({ username, room, lastActiveAt: now, createdAt: now });
                await newUser.save();
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

        socket.on("send_message", async ({ username, message, room }, callback) => {
            try {
                const sentimentResult = vaderSentiment.SentimentIntensityAnalyzer.polarity_scores(message);
                const sentimentScore = sentimentResult.compound;

                const newMessage = await Message.create({
                    username,
                    message,
                    room,
                    sentimentScore,
                });

                const user = await ActiveUser.findOne({ username, room });
                if (user) {
                    // Calculate new sentiment score based on messages since join time
                    const messagesSinceJoin = await Message.find({
                        username,
                        room,
                        createdAt: { $gte: user.createdAt }
                    });
                    
                    const totalSentiment = messagesSinceJoin.reduce((sum, msg) => sum + msg.sentimentScore, 0);
                    const averageSentiment = totalSentiment / messagesSinceJoin.length;

                    await ActiveUser.findOneAndUpdate(
                        { username, room },
                        {
                            $set: {
                                lastActiveAt: new Date(),
                                mood: getMood(averageSentiment),
                                sentimentScore: averageSentiment
                            }
                        },
                        { new: true }
                    );
                }

                io.to(room).emit("receive_message", {
                    username,
                    message,
                    _id: newMessage._id.toString(),
                    sentimentScore,
                });

                if (callback)
                    callback(null, {
                        id: newMessage._id.toString(),
                        message,
                        sentimentScore,
                    });
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
					io.to(room).emit("left_room", {
						username: "Admin",
						message: `${username} has left the room`,
					});
					
					socket.disconnect();
				} catch (error) {
					console.error("Error leaving room:", error);
				}
		});
				

        socket.on("edit_message", async ({ username, room, messageId, newMessage }) => {
            try {
                const updatedMessage = await Message.findOneAndUpdate(
                    { _id: messageId, username, room },
                    { message: newMessage, edited: true },
                    { new: true }
                );
                if (updatedMessage) {
                    socket.broadcast.to(room).emit("update_edited_message", {
                        messageId,
                        updatedMessage: updatedMessage.message,
                    });
                }
            } catch (error) {
                console.error("Error editing message:", error);
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