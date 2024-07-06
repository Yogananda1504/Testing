import { MongoClient } from "mongodb";
// Connection URI


// Create a new MongoClient
const client = new MongoClient('C');

// Connect to the MongoDB Atlas cluster
async function connectToMongoDB() {
	try {
		await client.connect();
		console.log('Connected to MongoDB Atlas');
		
		// Perform database operations here
		
	} catch (error) {
		console.error('Error connecting to MongoDB Atlas:', error);
	} finally {
		// Close the connection when done
		await client.close();
		console.log('Disconnected from MongoDB Atlas');
	}
}

// Call the connectToMongoDB function
connectToMongoDB();