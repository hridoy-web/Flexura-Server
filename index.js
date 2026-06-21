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
        const usersCollection = db.collection('users')
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
                    comments: [],
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




        /****** ADMIN DASHBOARD API SECTION ******/

        // Admin Dashboard - Overview Stats API
        app.get('/api/admin/dashboard/overview-stats', async (req, res) => {
            try {

                const totalUsers = await usersCollection.countDocuments();
                const approvedClasses = await classesCollection.countDocuments({ status: 'approved' })
                const totalTransactions = await bookingsCollection.countDocuments({ status: 'paid' })

                res.status(200).send({
                    success: true,
                    message: 'Admin overview stats fetched successfully',
                    data: {
                        totalUsers,
                        approvedClasses,
                        totalTransactions,
                    }
                })

            } catch (error) {
                console.error('Admin Overview Stats API Error:', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Admin Dashboard - GET All Registered Users List API
        app.get('/api/admin/users', async (req, res) => {
            try {

                const allUsers = await usersCollection.find().toArray();

                res.status(200).send({
                    success: true,
                    message: 'All users data fetched successfully',
                    data: allUsers,
                })

            } catch (error) {
                console.error('Admin Dashboard All Users GET API Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        //  Admin dasboard - Users Actions Block/unblock/Admin API
        app.patch('/api/admin/users/action/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { actionType } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Users ID'
                    })
                }

                let setUsersAction = {};
                let successMessage = '';

                if (actionType === 'block') {
                    setUsersAction = { $set: { status: 'blocked' } }
                    successMessage = 'User has been blocked successfully'
                } else if (actionType === 'unblock') {
                    setUsersAction = { $set: { status: 'active' } }
                    successMessage = 'User has been unblocked successfully'
                } else if (actionType === 'makeAdmin') {
                    setUsersAction = { $set: { role: 'admin' } }
                    successMessage = 'User has been promoted to admin'
                } else {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Action Type!'
                    })
                }

                const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, setUsersAction)

                if (!result.matchedCount) {
                    return res.status(404).send({
                        success: false,
                        message: 'user not found'
                    })
                }

                if (!result.modifiedCount) {
                    return res.status(200).send({
                        success: true,
                        message: 'No changes needed'
                    })
                }

                res.status(200).send({
                    success: true,
                    message: successMessage,
                    data: result
                })

            } catch (error) {
                console.error('Admin Dashboard - User Action API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Admin dasboard - Get All Pending Trainer Applications
        app.get('/api/admin/trainer-applications', async (req, res) => {
            try {

                const applications = await usersCollection.find({ trainerStatus: 'pending' }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Pending Trainer Applications data fetched successfully',
                    data: applications,
                })

            } catch (error) {
                console.error('Admin Dashboard - Trainer application GET API Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }

        })

        // Admin dasboard - Trainer Application (Approve / Reject with Feedback)
        app.patch('/api/admin/trainer-applications/action/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status, feedback } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Id'
                    })
                }

                let updateDoc = {};
                if (status === 'approved') {
                    updateDoc = {
                        $set: {
                            role: 'trainer',
                            trainerStatus: 'approved',
                            feedback: feedback || ''
                        }
                    }
                } else if (status === 'rejected') {
                    updateDoc = {
                        $set: {
                            role: 'user',
                            trainerStatus: 'rejected',
                            feedback: feedback
                        }
                    }
                } else {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Status'
                    })
                }

                const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, updateDoc)

                res.status(200).send({
                    success: true,
                    message: `Application ${status} successfully`,
                    data: result
                })

            } catch (error) {
                console.error('Admin Dashboard - Trainer Application Action PATCH API Error:', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Get All Active Trainers
        app.get('/api/admin/active/trainers', async (req, res) => {
            try {
                const trainerList = await usersCollection.find({ role: 'trainer' }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'All active trainers data fetched successfully',
                    data: trainerList,
                })

            } catch (error) {
                console.error('Admin Dashboard - GET Active Trainers API Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Get All Submitted Trainer Classes
        app.get('/api/admin/trainer-classes', async (req, res) => {
            try {
                const classes = await classesCollection.find().toArray()

                res.status(200).send({
                    success: true,
                    message: 'All trainer Class fetched successful',
                    data: classes,
                })

            } catch (error) {
                console.error('Admin Dashboard - All Trainer Classes GET API Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
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

                const result = await classesCollection.deleteOne({ _id: new ObjectId(id) })

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

        // Trainer Dashboard - ALL Forum POST Collection API
        app.get('/api/trainer/my-forum-posts/:email', async (req, res) => {
            try {
                const email = req.params.email;

                const result = await forumPostCollection.find({ authorEmail: email }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Trainer forum posts fetched successfully',
                    data: result
                })

            } catch (error) {
                console.error('Trainer Dashboard - all forum post GET API error ', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Trainer Dashboard - Trainer Forum post Delete API
        app.delete('/api/trainer/forum-posts/delete/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid forum post ID'
                    })
                }

                const result = await forumPostCollection.deleteOne({ _id: new ObjectId(id) })

                res.status(200).send({
                    success: true,
                    message: 'Forum post deleted successfully',
                    data: result
                })

            } catch (error) {
                console.error('Trainer Forum post Delete API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Trainer Dashboard - Class Enrolled Students Data API
        app.get('/api/trainer/classes/students/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Id Format'
                    })
                }

                const result = await bookingsCollection.find({ classId: id }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Class Enrolled students Data fetched successfully',
                    data: result
                })

            } catch (error) {
                console.error('Trainer Dashboard - Class Enrolled Students GET Api Error', error)

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })







        // ******* PAGE ROUTE API *******//

        // [GET] ALL Community Forum Page - with Server-side Pagination (Public) 
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

        // Single class Api (Private)
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