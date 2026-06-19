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

        /***** Shared API Section *****/

        // [POST] Add forum post - ADMIN and TRAINER Dashboard api
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
                    message: 'Post Successfully Added in forum',
                    insertedId: result.insertedId
                })

            } catch (error) {

                console.error('forum POST API Error', error)

                res.status(500).send({
                    message: "Forum Post Unsuccessful",
                    error: error.message
                })
            }
        })


        //**** Trainner DASHBOARD API Section ******//

        // Trainer Dashboard - OverView API
        app.get('/api/trainer/overview/:email', async (req, res) => {
            try {

                const email = req.params.email;

                const totalClasses = await classesCollection.countDocuments({ trainerEmail: email })
                const totalForumPosts = await forumPostCollection.countDocuments({ authorEmail: email })

                const bookingStats = await classesCollection.aggregate([
                    { $match: { trainerEmail: email } },
                    { $group: { _id: null, totalStudents: { $sum: "$bookingCount" } } }
                ]).toArray();

                const totalStudents = bookingStats.length > 0 ? bookingStats[0].totalStudents : 0;

                res.status(200).send({
                    success: true,
                    message: 'Trainer Overview Data fetched successfully',
                    stats: {
                        totalClasses,
                        totalStudents,
                        totalForumPosts
                    }
                })
            } catch (error) {
                console.error('Trainer Overview Api Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Failed to fetch overview data',
                    error: error.message,
                })
            }
        })

        // Trainner Dashboard - Class Added API
        app.post('/api/trainer/classes', async (req, res) => {
            try {
                const { className, image, category, difficultyLevel, duration, scheduleDays, time, price, description, trainerEmail, trainerName } = req.body;

                const newClass = {
                    className,
                    image,
                    category,
                    difficultyLevel,
                    duration,
                    scheduleDays,
                    time,
                    price: parseFloat(price),
                    description,
                    trainerEmail,
                    trainerName,
                    bookingCount: 0,
                    status: 'pending',
                    createdAt: new Date()
                }

                const result = await classesCollection.insertOne(newClass);

                res.status(201).send({
                    success: true,
                    message: 'Class added successfully and pending for Admin approval!',
                    insertedId: result.insertedId
                })

            } catch (error) {

                console.error('Trainer Class Added Api Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal server error! Failed to add class.',
                    error: error.message
                })
            }
        })

        // Trainer Dashboard - GET All Classes API
        app.get('/api/trainer/my-classes/:email', async (req, res) => {
            try {
                const email = req.params.email;

                const result = await classesCollection.find({ trainerEmail: email }).sort({ createdAt: -1 }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Trainer classes fetched successfully',
                    data: result,
                })

            } catch (error) {
                console.error('Trainer Dashboard My Classes GET API Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Trainer Dashboard - Trainer Class UPDATE API
        app.put('/api/trainer/classes/update/:id', async (req, res) => {
            try {

                const id = req.params.id;
                const classesData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: "Wrong Class ID"
                    })
                }

                const filter = { _id: new ObjectId(id) }

                const updateClassesData = {
                    $set: {
                        className: classesData.className,
                        image: classesData.image,
                        category: classesData.category,
                        difficultyLevel: classesData.difficultyLevel,
                        duration: classesData.duration,
                        scheduleDays: classesData.scheduleDays,
                        time: classesData.time,
                        price: parseFloat(classesData.price),
                        description: classesData.description,
                    }
                }

                const result = await classesCollection.updateOne(filter, updateClassesData)

                res.status(200).send({
                    success: true,
                    message: 'Class Content Successfully Update',
                    data: result
                })

            } catch (error) {
                console.error('Trainer Dashboard Class Update API Error:', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Trainer Dashboard - Class DELETE API
        app.delete('/api/trainer/classes/delete/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invaild Class ID Format'
                    })
                }

                const result = await classesCollection.deleteOne({_id: new ObjectId(id)})

                res.status(200).send({
                    success: true,
                    message: 'Class has been deleted successfully',
                    data: result
                })

            } catch (error) {
                console.error('Trainer Dashboard - Class Delete API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })


        // ******* PAGE ROUTE API *******//

        // [GET] ALL Community Forum Page with Server-side Pagination (Public) 
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

                console.error('forum posts GET API arror', error)

                res.status(500).send({
                    success: false,
                    message: 'Community forum post fetched failed',
                    error: error.message
                })
            }
        })

        // [GET] Community Single Forum Post Details Page (Private)
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

        // Single class Api
        app.get('/api/classes/single/:id', async (req, res) => {
            try {

                const id = req.params.id;

                const result = await classesCollection.findOne({ _id: new ObjectId(id) });

                res.status(200).send({
                    success: true,
                    message: 'Single Class Data fetched successfully',
                    data: result,
                })

            } catch (error) {
                console.error('Single Class API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })






        /******* HOME PAGE API ******/

        // [GET] Home top 3 latest forum post API
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
                    error: error.message
                })
            }
        })


        // [GET] HOME Featured Class API
        app.get('/api/featured-classes', async (req, res) => {
            try {

                const result = await classesCollection.find({ status: 'approved' })
                    .sort({ bookingCount: -1 })
                    .limit(6)
                    .toArray();

                res.status(200).send({
                    success: true,
                    message: 'featured class fetched successfully',
                    data: result,
                })

            } catch (error) {
                console.error('Featured Class Api Error', error)
                res.status(500).send({
                    success: false,
                    message: 'featured class load failed',
                    error: error.message
                })
            }
        })

        /**** USER DASHBOARD API *****/

        // [POST] Add to Favorites Button API Functionality
        app.post('/api/favorites/add', async (req, res) => {

            const { classId, userEmail, className, image, trainerName } = req.body

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