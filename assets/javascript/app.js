import express from 'express';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi';
import cors from 'cors';
import dotenv from 'dotenv';


// express configuration

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());


const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'chat_zap_db'


const participantSchena = joi.object({
    name: joi.string().required()
});

const messageSchena = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.any().valid('message', 'private_message')
});

// mongo configuration

let db;

async function connectToMongo() {
    try {
        const mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        console.log('Conexão com o MongoDB estabelecida com sucesso');
        db = mongoClient.db(DB_NAME);
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
    }
}


//participants

app.get('/participants', async (req, res) => {
    try {
        await connectToMongo();
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
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        await connectToMongo();
        const existingParticipant = await db.collection('participants').findOne({ name: req.body.name });

        if (!existingParticipant) {
            const insertParticipant = { ...participant, lastStatus: Date.now() };
            await db.collection('participants').insertOne(insertParticipant);

            const time = dayjs(Date.now()).format('HH:mm:ss');
            const message = { from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: time };
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


//messages

app.get('/messages', async (req, res) => {
    try {
        await connectToMongo();
        const messages = await db.collection('messages').find().toArray();
        res.send(messages);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const messageBody = req.body;
    const messageFrom = req.header.User;

    const validation = messageSchena.validate(messageBody, { abortEarly: true });
    if (validation.error) {
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        await connectToMongo();

        const existingParticipant = await db.collection('participant').findOne({ name: messageFrom });

        if (!existingParticipant) {
            res.sendStatus(422);
        }
        else {
            const time = dayjs(Date.now()).format('HH:mm:ss');
            const message = { ...messageBody, from: messageFrom, time: time };
            await db.collection('messages').insertOne(message);
            res.sendStatus(201);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//app.put('/messages', (req, res) => {});

//app.delete('/messages', (req, res) => {});

//app.post('/status', (req, res) => {});

app.listen(PORT, () => {
    console.log('Server is listening on port 5001.');
});