import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

// mongo configuration
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("chat_zap_db");
});

// express configuration
const app = express();
app.use(express.json());

//app.post('/participants', (req, res) => {});

//app.get('/messages', (req, res) => {});

//app.get('/participants', (req, res) => {});

//app.post('/status', (req, res) => {});

//app.post('/messages', (req, res) => {});

//app.put('/messages', (req, res) => {});

//app.delete('/messages', (req, res) => {});

app.listen(5001, () => {
    console.log('Server is listening on port 5001.');
});