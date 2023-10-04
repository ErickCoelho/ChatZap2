import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi';
import cors from 'cors';
import { stripHtml } from "string-strip-html";
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

function sanitize(object) {
    for (const key in object) {
        if (object.hasOwnProperty(key)) {
            const value = object[key];
            if (typeof value === 'string') object[key] = stripHtml(value).result.trim();
        }
    }
}

const objeto = { nome: "<div>eri</div><div>ck</div><b>coelho</b>", endereço: "      avenida         ", numero: 18 };
console.log(objeto);
sanitize(objeto);
console.log(objeto);


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
            sanitize(insertParticipant);
            await db.collection('participants').insertOne(insertParticipant);

            const time = dayjs(Date.now()).format('HH:mm:ss');
            const message = { from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: time };
            sanitize(message);
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
    const limit = parseInt(req.params.limit) || 100;
    const receiverName = req.headers.user;

    try {
        await connectToMongo();
        const messages = await db.collection('messages').find({ to: { $in: [receiverName, 'Todos'] } }).sort({ time: -1 }).limit(limit).toArray();
        res.send(messages.reverse());
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const messageBody = req.body;
    const messageFrom = req.headers.user;

    const validation = messageSchena.validate(messageBody, { abortEarly: true });
    if (validation.error) {
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        await connectToMongo();

        const existingParticipant = await db.collection('participants').findOne({ name: messageFrom });

        if (!existingParticipant) {
            res.sendStatus(422);
        }
        else {
            const time = dayjs(Date.now()).format('HH:mm:ss');
            const message = { ...messageBody, from: messageFrom, time: time };
            sanitize(message);
            await db.collection('messages').insertOne(message);
            res.sendStatus(201);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.put('/messages', async (req, res) => {
    try {
        await connectToMongo();

        const message = await db.collection('messages').find({ _id: new ObjectId(req.params.id) });
        sanitize(message);
        if (!message) {
            res.sendStatus(404);
        }
        else {
            if (message.from !== req.headers.user)
                res.sendStatus(401);
            else {
                const validation = messageSchena.validate(messageBody, { abortEarly: true });
                if (!validation)
                    res.sendStatus(404);
                else {
                    await db.collection('messages').updateOne({
                        _id: new ObjectId(req.params.id)
                    }, { $set: message });
                }
            }
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.delete('/messages', async (req, res) => {
    try {
        await connectToMongo();

        const message = await db.collection('messages').find({ _id: new ObjectId(req.params.id) });
        if (!message) {
            res.sendStatus(404);
        }
        else {
            if (message.from !== req.headers.user)
                res.sendStatus(401);
            else
                await db.collection('messages').delete({ _id: new ObjectId(req.params.id) });
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;

    try {
        await connectToMongo();

        const existingParticipant = await db.collection('participants').findOne({ name: user });

        if (!existingParticipant) {
            res.sendStatus(404);
        }
        else {
            const statusObject = { lastStatus: Date.now() }
            await db.collection('participants').updateOne({
                name: user
            }, { $set: statusObject });
            res.sendStatus(200);
        }
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

        const participants = await db.collection('participants').find({ lastStatus: { $lt: limitTime } })/*.sort( { lastStatus: -1 } )*/.toArray();
        participants.map(async (participant) => {
            try {
                const message = { from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: nowTime };
                sanitize(message);
                await db.collection('messages').insertOne(message);
            } catch (error) {
                console.error(error);
                res.sendStatus(500);
            }
        });

        await db.collection('participants').deleteMany({ lastStatus: { $lt: limitTime } });
    } catch (error) {

    }
}

setInterval(disconnectParticipant, 15000);



app.listen(PORT, () => {
    console.log('Server is listening on port 5001.');
});