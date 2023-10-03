const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dayjs = require('dayjs');
const joi = require('joi');
const cors = require('cors');
const dotenv = require('dotenv');
//dotenv.config();
const uri = "mongodb://localhost:27017/chat_zap_db";

const participantSchena = joi.object({
    name: joi.string().required()
});

// mongo configuration
//const mongoClient = new MongoClient(process.env.MONGO_URI);
const mongoClient = new MongoClient(uri);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("chat_zap_db");
});

async function mongoConnection() {
    try {
        await mongoClient.connect();
        console.log('Conexão com o MongoDB estabelecida com sucesso');
        db = mongoClient.db("chat_zap_db");
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
    }
}

// express configuration
const app = express();
app.use(express.json());
app.use(cors());

app.get('/participants', async (req, res) => {
    try {
        await mongoConnection();
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/participants', async (req, res) => {
    const participant = req.body;
    const validation = participantSchena.validate(participant, { abortEarly: true });
    if (validation.error) {
        res.send(422);
        console.log(validation.error.details);
        return;
    }

    try {
        await mongoConnection();
        const existingParticipant = await db.collection('participants').findOne({ _name: req.body.name });
        if(!existingParticipant) {
        const insertParticipant = { ...participant, lastStatus: Date.now() };
        await db.collection('participants').insertOne(insertParticipant);

        const time = dayjs(Date.now()).format('HH:mm:ss');
        const message = {from: req.body.name,  to: 'Todos', text: 'entra na sala...', type: 'status', time: time};
        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
        }
        else {
            res.sendStatus(409);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//app.get('/messages', (req, res) => {});

//app.post('/messages', (req, res) => {});

//app.put('/messages', (req, res) => {});

//app.delete('/messages', (req, res) => {});

//app.post('/status', (req, res) => {});

app.listen(5001, () => {
    console.log('Server is listening on port 5001.');
});