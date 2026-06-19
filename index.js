// require
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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


        // NO: 01 - [POST] Add forum post - admin and trainer dashboard api
        app.post('/api/forum-posts', async (req, res) => {
            try {
                const { title, image, description, authorName, authorEmail, authorRole } = req.body;

                const newPost = {
                    title,
                    image,
                    description,
                    authorName,
                    authorEmail,
                    authorRole,
                    like: [],
                    dislike: [],
                    createdAt: new Date()
                }

                const result = await forumPostCollection.insertOne(newPost);

                res.status(201).send({
                    success: true,
                    message: 'Post Successfully Added in forum'
                })

            } catch (error) {
                res.status(500).send({
                    message: "Forum Post Unsuccessful",
                    error: error.message
                })
            }
        })

        // NO: 02 [GET] Community Forum Page with Server-side Pagination (Public) 
        app.get('/api/forum-posts', async (req, res) => {
            try {

                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 6;
                const skip = (page - 1) * limit;

                const totalPosts = await forumPostCollection.countDocuments()

                const forumPostsData = await forumPostCollection.find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Latest forum posts fetched successfully',
                    totalPosts,
                    totalPage: Math.ceil(totalPosts / limit),
                    data: forumPostsData
                })

            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: 'Community forum post fetched failed',
                    error: error.message
                })
            }
        })

        // NO: 03 [GET] Home top 3 latest forum post API
        app.get('/api/latest-forum-posts', async (req, res) => {
            try {
                const result = await forumPostCollection.find().sort({ createdAt: -1 }).limit(3).toArray()

                res.status(200).send({
                    success: true,
                    message: 'home page 3 latest forum post data fetched',
                    data: result
                })

            } catch (error) {

                console.error('Home page 3 latest post - Get api error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal server error',
                })
            }
        })

        // NO: 04 [GET] Single Forum Post Details Page (Private)
        app.get('/api/forum-posts/:id', async (req, res) => {

            try {
                const id = req.params.id;

                const result = await forumPostCollection.findOne({ _id: new ObjectId(id) })

                res.status(200).send({
                    success: true,
                    message: "Single Forum Data successfully fetched",
                    data: result
                })
            } catch (error) {
                console.error('forum single posts api error', error)
                res.status(500).send({
                    success: false,
                    message: error.message
                })
            }
        })










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