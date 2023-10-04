import express, { json } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi';
import cors from 'cors';
import { stripHtml } from "string-strip-html";
import dotenv from 'dotenv';


dotenv.config();
const app = express();
app.use(json());
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
    type: joi.string().valid('message', 'private_message')
});

function sanitize(object) {
    for (const key in object) {
        if (object.hasOwnProperty(key)) {
            const value = object[key];
            if (typeof value === 'string') object[key] = stripHtml(value).result.trim();
        }
    }
}


let db;
let participantsCollection;
let messagesCollection;
const mongoClient = new MongoClient(MONGO_URI);

async function connectToMongo() {
    try {
        await mongoClient.connect();
        console.log('Conexão com o MongoDB estabelecida com sucesso');
        db = mongoClient.db(DB_NAME);
        participantsCollection = db.collection('participants');
        messagesCollection = db.collection('messages');
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
    }
}


app.get('/participants', async (req, res) => {
    try {
        await connectToMongo();
        const participants = await participantsCollection.find().toArray();
        await mongoClient.close();
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

        const existingParticipant = await participantsCollection.findOne({ name: req.body.name });

        if (existingParticipant) {
            res.sendStatus(409);
        }

        const insertParticipant = { ...participant, lastStatus: Date.now() };
        sanitize(insertParticipant);
        await participantsCollection.insertOne(insertParticipant);

        const message = {
            from: req.body.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(Date.now()).format('HH:mm:ss')
        };
        sanitize(message);
        await messagesCollection.insertOne(message);

        await mongoClient.close();
        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.params.limit) || 100;
    const participant = req.headers.user;

    try {
        await connectToMongo();
        const messages = await messagesCollection.find({ to: { $in: [participant, 'Todos'] } }).sort({ time: -1 }).limit(limit).toArray();

        await mongoClient.close();
        res.send(messages.reverse());

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const messageBody = req.body;
    const from = req.headers.user;

    const validation = messageSchena.validate(messageBody, { abortEarly: true });
    if (validation.error)
        return res.status(422).send(validation.error.details);

    try {
        await connectToMongo();

        const existingParticipant = await participantsCollection.findOne({ name: from });

        if (!existingParticipant)
            return res.sendStatus(422);

        const message = { 
            ...messageBody, 
            from: from, 
            time: dayjs(Date.now()).format('HH:mm:ss') 
        };
        sanitize(message);
        await messagesCollection.insertOne(message);

        await mongoClient.close();
        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.put('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const message = req.body;
    const from = req.headers.user;

    const validation = messageSchena.validate(message, { abortEarly: true });
    if (!validation)
        return res.sendStatus(422);

    try {
        await connectToMongo();

        const existingMessage = await messagesCollection.findOne({ _id: new ObjectId(id) });
        if (!existingMessage)
            return res.sendStatus(404);

        if (existingMessage.from !== from)
            return res.sendStatus(401);

        sanitize(message);
        await messagesCollection.updateOne({
            _id: new ObjectId(id)
        }, {
            $set: message
        });

        await mongoClient.close();
        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const participant = req.headers.user;

    try {
        await connectToMongo();

        const existingMessage = await messagesCollection.findOne({ _id: new ObjectId(id) });

        if (!existingMessage)
            return res.sendStatus(404);

        if (existingMessage.from !== participant)
            return res.sendStatus(401);

        await messagesCollection.deleteOne({
            _id: existingMessage._id
        });

        await mongoClient.close();
        res.sendStatus(200);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;

    try {
        await connectToMongo();

        const existingParticipant = await participantsCollection.findOne({ name: user });

        if (!existingParticipant)
            return res.sendStatus(404);

        await participantsCollection.updateOne({
            _id: existingParticipant._id
        }, {
            $set: { lastStatus: Date.now() }
        });

        await mongoClient.close();
        res.sendStatus(200);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});


//remover participantes
async function disconnectParticipant() {
    try {
        await connectToMongo();

        const limitTime = Date.now() - 10000;
        const nowTime = dayjs(Date.now()).format('HH:mm:ss');

        const participants = await participantsCollection.find({ lastStatus: { $lt: limitTime } })/*.sort( { lastStatus: -1 } )*/.toArray();
        if (!participants) {
            await mongoClient.close();
            return;
        }

        participants.map(async (participant) => {
            try {
                const message = { from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: nowTime };
                sanitize(message);
                await messagesCollection.insertOne(message);
            } catch (error) {
                console.error(error);
                res.sendStatus(500);
            }
        });

        await participantsCollection.deleteMany({ lastStatus: { $lt: limitTime } });
    } catch (error) {
        console.log(error);
    }
}

setInterval(disconnectParticipant, 15000);



app.listen(PORT, () => {
    console.log('Server is listening on port 5001.');
});