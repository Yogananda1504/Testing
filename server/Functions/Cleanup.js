import ActiveUser from "../models/ActiveUser.js";



//Generate a cleanUp function which checks the active users and deletes the ones that have not been active for 15 or more minutes
export const Clean_up = async () => {
    try {
        console.log("Cleanup Function Running...")
        const activeUsers = await ActiveUser.find();
        const currentTime = Date.now();
        const usersToDelete = activeUsers.filter(user => currentTime - user.lastActiveAt.getTime() > 15 * 60 * 1000);
        const deletePromises = usersToDelete.map(user => ActiveUser.deleteOne({ username: user.username, room: user.room }));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error cleaning up active users:", error);
    }
};

//Since the maximum Inactivity would be 15 minute we can run the cleanUp function every 15 minutes



