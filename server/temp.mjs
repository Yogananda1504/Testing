import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { MongoClient, ServerApiVersion } from "mongodb";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Clean_up } from "./controllers/Cleanup.js";

// Import routers and socket controller
import chatRouter from "./routes/chatRouter.js";
import handleSocketEvents from "./controllers/socketController.js";
import cookieParser from "cookie-parser";

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildPath = join(__dirname, "..", "client", "dist");

export default async () => {
	const app = express();
	const server = http.createServer(app);

	// Redis setup
	const redisHost =
		process.env.REDIS_HOST ||
		"redis-18297.c15.us-east-1-4.ec2.redns.redis-cloud.com";
	const redisPort = process.env.REDIS_PORT || 18297;
	const redisPassword = process.env.REDIS_PASSWORD; // Make sure to set this in your .env file

	const io = new Server(server, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
	});

	const pubClient = createClient({
		socket: {
			host: redisHost,
			port: redisPort,
		},
		password: "XZtUcng50GxedzfS4P5ELpJm4PwJOvKG",
	});
	const subClient = pubClient.duplicate();

	// Handle Redis client connection
	const connectRedis = async () => {
		try {
			await pubClient.connect();
			await subClient.connect();
			console.log("Successfully connected to Redis");
		} catch (error) {
			console.error("Failed to connect to Redis:", error);
			process.exit(1);
		}
	};

	await connectRedis();

	io.adapter(createAdapter(pubClient, subClient));

	// CORS configuration
	let config = {
		origin: "http://localhost:5173",
		method: ["GET", "POST"],
		credentials: true,
	};
	app.use(cors(config));
	app.use(express.json());
	app.use(cookieParser());

	// MongoDB connection setup
	const uri =
		process.env.MONGO_DB_URI ||
		"mongodb+srv://vynr1504:Vynr_1504@cluster0.h75zeux.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0/chat";

	// MongoClient options
	const mongoClientOptions = {
		serverApi: {
			version: ServerApiVersion.v1,
			strict: true,
			deprecationErrors: true,
		},
		socketTimeoutMS: 45000,
		connectTimeoutMS: 45000,
		serverSelectionTimeoutMS: 45000,
	};

	const client = new MongoClient(uri, mongoClientOptions);

	async function connectToMongo() {
		try {
			await mongoose.connect(uri, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				socketTimeoutMS: 45000,
				connectTimeoutMS: 45000,
				serverSelectionTimeoutMS: 45000,
			});
			console.log("Mongoose connected to MongoDB");

			await client.connect();
			await client.db("admin").command({ ping: 1 });
			console.log(
				"Pinged your deployment. MongoClient successfully connected to MongoDB!"
			);
		} catch (error) {
			console.error("Failed to connect to MongoDB:", error);
			process.exit(1);
		}
	}

	// Connect to MongoDB
	await connectToMongo();

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

	// Cleanup of the users for inactivity management
	setInterval(Clean_up, 15 * 60 * 1000);

	// Start the server on a worker process
	const port = process.env.PORT || 4000;
	server.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});

	// Ensure that the client will close when you finish/error
	process.on("SIGINT", async () => {
		await client.close();
		await mongoose.connection.close();
		await pubClient.quit();
		await subClient.quit();
		process.exit(0);
	});
};
