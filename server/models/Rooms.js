
import mongoose from "mongoose";
const  Rooms = mongoose.model("Rooms", {
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now ,expires: '2d'},
});

export default Rooms;
