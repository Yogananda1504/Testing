import Message from "../models/Message.js";
import ActiveUser from "../models/ActiveUser.js";
import Rooms from "../models/Rooms.js";




// Socket controller for handling socket events
const  handleSocketEvents = (io) => {
	io.on("connection", (socket) => {
		console.log("New client connected");

		socket.on("join", async ({ username,room }) => {
			socket.join(room);
			console.log(`Pseudo-joined room ${room}`);
			const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:Date.now()}); }
		});

		socket.on("error", (err) => {
			console.log(`socket error ${err.message}`);
		});

		socket.on("connect_error", (error) => {
			console.log("Connection Error: ", error);
		});

		socket.on("connect_timeout", (timeout) => {
			console.log("Connection Timeout: ", timeout);
		});

		socket.on("reconnect", () => {
			console.log("Client reconnected:", socket.id);
			// Perform any necessary actions, such as re-joining the room
		});

		socket.on("reconnect_error", (error) => {
			console.error("Socket reconnection error:", error);
			// Handle reconnection error, e.g., log or emit an event
		});

		socket.on("check_room_exists", async (room) => {
			try {
				const roomExists = await Rooms.exists({ name: room });
				socket.emit("room_exists", roomExists);
			} catch (error) {
				console.error("Error checking if room exists:", error);
				socket.emit("room_exists", false);
			}
		});

		socket.on("check_username", async ({ username, room }) => {
			console.log(`Checking if username ${username} is taken in room ${room}`);
			try {
				// Check if room already exists, if not, save it into the Room database
				const roomExists = await Rooms.exists({ name: room });
				if (!roomExists) {
					const newRoom = new Rooms({ name: room });
					await newRoom.save();
					console.log("Room saved to database");
				}
				// Check if the username is already taken in the room
				const user = await ActiveUser.findOne({ username, room });
				if (user) {
					socket.emit("username_taken", true);
				} else {
					socket.emit("username_taken", false);
				}
			} catch (error) {
				console.error("Error checking username:", error);
			}
		});

		socket.on("join_room", async ({ username, room }) => {
			console.log(`${username} is trying to join the room ${room}`);
			try {
				socket.join(room);
				const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:Date.now()}); }

				// Save active user to MongoDB
				const activeUser = new ActiveUser({
					username,
					room,
					socketId: socket.id,
				});
				await activeUser.save();
				console.log("Active user saved to database");

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

				const activeUsersInRoom = await ActiveUser.find({ room });
				io.to(room).emit("chatroom_users", activeUsersInRoom);
			} catch (error) {
				console.error("Error joining room:", error);
			}
		});

		socket.on("send_message", async ({ username, message, room }, callback) => {
			try {

				console.log(`${username} is sending a message in the room ${room}`);
				const newMessage = new Message({ username, message, room });
				await newMessage.save();
				const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:Date.now()}); }

				io.to(room).emit("receive_message", {
					username,
					message,
					_id: newMessage._id.toString(), // Ensure ID is correctly sent
				});

				if (callback)
					callback(null, { id: newMessage._id.toString(), message });
			} catch (error) {
				console.error("Error sending message:", error);
				if (callback) callback(error.message);
			}
		});

		socket.on("delete_for_me", async ({ username,room,messageIds }) => {
			try {
				console.log(
					`Received request to delete messages for user: ${username}`
				);
				console.log(`Message IDs: ${messageIds}`);

				const result = await Message.updateMany(
					{ _id: { $in: messageIds } },
					{ $addToSet: { deletedForMe: username } }
				);

				const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:Date.now()}); }

				console.log(
					`Messages marked for deletion for user ${username}. Update result:`,
					result
				);
			} catch (error) {
				console.error("Error marking messages for deletion:", error);
			}
		});

		socket.on("update_activity",(username,room,time)=>{
			try{
				const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:time}); }
				
			}catch(error){
				console.error("Error updating activity:",error);
			}

		});

		socket.on("delete_for_everyone", async ({ username, room, messageIds }) => {
			try {
				console.log(
					`Received request to delete messages for everyone from user: ${username}`
				);
				console.log(`Message IDs: ${messageIds}`);

				const result = await Message.updateMany(
					{ _id: { $in: messageIds } },
					{
						message: "This message was deleted",
						deletedForEveryone: true,
						deletedBy: username,
					}
				);

				const user = ActiveUser.findOne({username,room});
				if(user)
                { ActiveUser.updateOne({username,room},{lastActiveAt:Date.now()}); }

				console.log(
					`Messages marked for deletion for everyone by user ${username}. Update result:`,
					result
				);

				io.to(room).emit("messages_deleted", {
					messageIds,
					username,
				});
			} catch (error) {
				console.error("Error marking messages for deletion:", error);
			}
		});

		socket.on("disconnect", async () => {
			console.log("Client disconnected");
			try {
				const user = await ActiveUser.findOne({ socketId: socket.id });
				if (user) {
					const { username, room } = user;

					await ActiveUser.deleteOne({ username, room });

					socket.to(room).emit("left_room", {
						username: "Admin",
						message: `${username} has left the room`,
					});

					const activeUsersInRoom = await ActiveUser.find({ room });
					io.to(room).emit("chatroom_users", activeUsersInRoom);
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

				const activeUsersInRoom = await ActiveUser.find({ room });
				io.to(room).emit("chatroom_users", activeUsersInRoom);

				socket.disconnect();
			} catch (error) {
				console.error("Error leaving room:", error);
			}
		});
		socket.on("remove_user",async ({username,room})=>{
			try {
				await ActiveUser.deleteOne({ username, room });
                const activeUsersInRoom = await ActiveUser.find({ room });
				io.to(room).emit("chatroom_users", activeUsersInRoom);
                socket.disconnect();
			} catch (error) {
				console.error("Error leaving room:", error);
			}

		});

		socket.on("edit_message",async ({username,room,messageId,newMessage})=>{
			try {
				const message = await Message.findOne({ _id: messageId });
				if (message) {
					if (message.username === username && room === message.room) {
						await Message.updateOne(
							{
								_id: messageId,
							},
							{ message: newMessage,edited:true }
						);
					}
				}
				const updatedMessage=newMessage;
				socket.broadcast.to(room).emit("update_edited_message", {messageId,updatedMessage});
			}catch(error)
			{
				console.error("Error editing message:",error);
			}


		});
			
	
	});
};

export default handleSocketEvents;

