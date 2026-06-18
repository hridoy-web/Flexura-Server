// require
const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors')
require('dotenv').config()

const app = express();
const port = process.env.PORT
const uri = process.env.MONGODB_URI

// midleware
app.use(cors())
app.use(express.json())

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {

        // all database collection 
        const db = client.db('flexuraDb')
        const userCollection = db.collection('users')
        const classesCollection = db.collection('classes')
        const bookingsCollection = db.collection('bookings')
        const favoritesCollection = db.collection('favorites')
        const forumPostCollection = db.collection('forumPosts')

        console.log("Connected Successfully to MongoDB!");






















        
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Flexura server is working fine')
})

// server start
app.listen(port, () => {
    console.log(`Flexura Server is Runing on ${port} Port`)
})