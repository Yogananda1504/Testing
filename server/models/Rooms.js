
import mongoose from "mongoose";
const  Rooms = mongoose.model("Rooms", {
    name: { type: String, required: true },
    activeusers:{type:Number,default:0},
    createdAt: { type: Date, default: Date.now ,expires: '2d'},
});

export default Rooms;
