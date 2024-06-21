import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createAdapter } from '@socket.io/redis-adapter';
import redis from 'redis';

// Import routers and socket controller
import chatRouter from './routes/chatRouter.js';
import handleSocketEvents from './controllers/socketController.js';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildPath = join(__dirname, "..", "client", "dist");

export default async () => {
   const app = express();
   const server = http.createServer(app);
   
   const redisHost = process.env.REDIS_HOST || "localhost";
   const redisPort = process.env.REDIS_PORT || 6379;

   const io = new Server(server, {
       cors: {
           origin: "*",
           methods: ["GET", "POST"],
       },
   });

   // Set up Redis adapter
   const pubClient = redis.createClient({
       host: redisHost,
       port: redisPort
   });
   const subClient = pubClient.duplicate();

   // Handle Redis client connection
   const connectRedis = () => {
       return new Promise((resolve, reject) => {
           pubClient.on('connect', resolve);
           pubClient.on('error', reject);
           if (pubClient.connect && typeof pubClient.connect === 'function') {
               pubClient.connect();
           }
       });
   };

   try {
       await connectRedis();
       console.log('Successfully connected to Redis');
   } catch (error) {
       console.error('Failed to connect to Redis:', error);
   }

   io.adapter(createAdapter(pubClient, subClient));

   app.use(cors());
   app.use(express.json());

   // MongoDB connection
   const MONGO_DB_URI = process.env.MONGO_DB_URI || "mongodb://127.0.0.1:27017/chat";
   await mongoose.connect(MONGO_DB_URI, {
       useNewUrlParser: true,
       useUnifiedTopology: true,
   });

   console.log("Successfully connected to the Database");

   // Mount routers
   app.use("/api", chatRouter);

   // Serve static files from the React app's build directory
   app.use(express.static(buildPath));

   // Redirect any non-API routes to the front end's index.html
   app.get("*", (req, res) => {
       res.sendFile(join(buildPath, "index.html"));
   });
   
   // Initialize socket controller
   handleSocketEvents(io);

   // Start the server on a worker process
   const port = process.env.PORT || 4000;
   server.listen(port, () => {
       console.log(`Server running on port ${port}`);
   });
};