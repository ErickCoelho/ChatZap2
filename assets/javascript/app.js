import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs'
import joi from 'joi';
import dotenv from 'dotenv';
dotenv.config();

const participantSchena = joi.object({
   name: joi.string().required() 
});

// mongo configuration
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("chat_zap_db");
});

// express configuration
const app = express();
app.use(express.json());

app.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/participants', async (req, res) => {
    const participant = req.body;
    const validation = participantSchena.validate(participant, {abortEarly: true});
    if(validation.error){
        res.send(422);
        console.log(validation.error.details);
        return;
    }

    try {
        const existingParticipant = await db.collection('participants').findOne({ _name: req.body.name });
        if(!existingParticipant) {
            await db.collection('participants').insertOne({...participant, lastStatus: Date.now()});
            
            const time = dayjs(Date.now()).format('HH:mm:ss');
            const message = {from: req.body.name,  to: 'Todos', text: 'entra na sala...', type: 'status', time: time};
            await db.collection('messages').insertOne(message)
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