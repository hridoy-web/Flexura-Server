// require
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;
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
        const usersCollection = db.collection('user')
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

        // Trainer Class Delete API - Admin Dashboard or Trainer Dashboard
        app.delete('/api/classes/delete/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Class ID Format'
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

        // Forum post Delete API - Admin and Trainer Dashboard
        app.delete('/api/forum-posts/delete/:id', async (req, res) => {
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


        /****** ADMIN DASHBOARD API SECTION ******/

        // 1. Admin Dashboard - Overview Stats API 
        app.get('/api/admin/dashboard/overview-stats', async (req, res) => {
            try {
                const totalUsers = await usersCollection.countDocuments()
                const totalClasses = await classesCollection.countDocuments()
                const totalBookedClasses = await bookingsCollection.countDocuments()

                res.status(200).send({
                    success: true,
                    message: 'Admin overview stats fetched successfully',
                    data: {
                        totalUsers,
                        totalClasses,
                        totalBookedClasses,
                    }
                })

            } catch (error) {
                console.error('Admin Overview Stats API Error:', error);
                res.status(500).send({
                    success: false, message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 2. Admin Dashboard - GET All Registered Users List API
        app.get('/api/admin/users', async (req, res) => {
            try {
                const allUsers = await usersCollection.find().toArray();

                res.status(200).send({
                    success: true,
                    message: 'All users data fetched successfully',
                    data: allUsers,
                });

            } catch (error) {
                console.error('Admin Dashboard All Users GET API Error', error);
                res.status(500).send({
                    success: false, message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 3. Admin Dashboard - Users Actions Block/unblock/ API
        app.patch('/api/admin/users/action/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { actionType } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Users ID'
                    });
                }

                let setUsersAction = {};
                let successMessage = '';

                if (actionType === 'block') {
                    setUsersAction = { $set: { status: 'blocked' } };
                    successMessage = 'User has been blocked successfully';
                } else if (actionType === 'unblock') {
                    setUsersAction = { $set: { status: 'active' } };
                    successMessage = 'User has been unblocked successfully';
                } else if (actionType === 'makeAdmin') {
                    setUsersAction = { $set: { role: 'admin' } };
                    successMessage = 'User has been promoted to admin';
                } else {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Action Type!'
                    });
                }

                const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, setUsersAction);

                if (!result.matchedCount) {
                    return res.status(404).send({
                        success: false,
                        message: 'User not found'
                    });
                }

                res.status(200).send({
                    success: true,
                    message: successMessage,
                    data: result
                });

            } catch (error) {
                console.error('Admin Dashboard - User Action API Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        const verifyNotBlocked = async (req, res, next) => {
            const email = req.body.userEmail || req.query.email || req.body.authorEmail;
            if (!email) return next();

            const user = await usersCollection.findOne({ email: email });
            if (user && user.status === 'blocked') {
                return res.status(403).send({
                    success: false,
                    message: 'Action restricted by Admin'
                });
            }
            next();
        };

        // 4. Admin Dashboard - Get All Pending Trainer Applications
        app.get('/api/admin/trainer-applications', async (req, res) => {
            try {
                const applications = await usersCollection.find({ trainerStatus: 'pending' }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'Pending Trainer Applications data fetched successfully',
                    data: applications,
                })

            } catch (error) {
                console.error('Admin Dashboard - Trainer application GET API Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 5. Admin Dashboard - Trainer Application (Approve / Reject with Feedback)
        app.patch('/api/admin/trainer-applications/action/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status, feedback } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ success: false, message: 'Invalid Id' });
                }

                let updateDoc = {};
                if (status === 'approved') {
                    updateDoc = {
                        $set: {
                            role: 'trainer',
                            trainerStatus: 'approved',
                            adminFeedback: feedback || ''
                        }
                    };
                } else if (status === 'rejected') {
                    updateDoc = {
                        $set: {
                            role: 'user',
                            trainerStatus: 'rejected',
                            adminFeedback: feedback
                        }
                    };
                } else {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Status'
                    });
                }

                const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

                res.status(200).send({
                    success: true,
                    message: `Application ${status} successfully`,
                    data: result
                })

            } catch (error) {
                console.error('Admin Dashboard - Trainer Application Action PATCH API Error:', error);
                res.status(500).send({ success: false, message: 'Internal Server Error!', error: error.message });
            }
        });

        // 6. Admin Dashboard - Get All Active Trainers
        app.get('/api/admin/active/trainers', async (req, res) => {
            try {
                const trainerList = await usersCollection.find({ role: 'trainer' }).toArray();
                res.status(200).send({
                    success: true,
                    message: 'All active trainers data fetched successfully',
                    data: trainerList
                });

            } catch (error) {
                console.error('Admin Dashboard - GET Active Trainers API Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 7. Admin Dashboard - Demote Trainer to Normal User API
        app.patch('/api/admin/trainers/demote/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Id'
                    });
                }

                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: 'user', trainerStatus: 'demoted' } }
                );

                res.status(200).send({
                    success: true,
                    message: 'Trainer status demoted successfully',
                    data: result
                })

            } catch (error) {
                console.error('Admin Dashboard - Demote Trainer API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 8. Admin Dashboard - Get All Submitted Trainer Classes
        app.get('/api/admin/trainer-classes', async (req, res) => {
            try {
                const classes = await classesCollection.find().sort({ createdAt: -1 }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'All trainer Class fetched successful',
                    data: classes
                })

            } catch (error) {
                console.error('Admin Dashboard - All Trainer Classes GET API Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                })
            }
        });

        // 9. Admin Dashboard - Trainer Classes Reject or Approve
        app.patch('/api/admin/classes/status/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Class ID Format'
                    });
                }

                if (!status) {
                    return res.status(400).send({
                        success: false,
                        message: 'Status field is required'
                    });
                }

                const result = await classesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: status } }
                );

                res.status(200).send({
                    success: true,
                    message: `Class is now ${status}`,
                    data: { id, status, modifiedCount: result.modifiedCount }
                });

            } catch (error) {
                console.error('Admin Dashboard - Class Status Update PATCH API Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 10. Admin Dashboard - Get All Forum Posts
        app.get('/api/admin/find/all-forum-posts', async (req, res) => {
            try {
                const result = await forumPostCollection.find().sort({ createdAt: -1 }).toArray();

                res.status(200).send({
                    success: true,
                    message: 'All forum post fetched successfully',
                    data: result
                })

            } catch (error) {
                console.error('Admin Dashboard - Get all forum Post Api Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });

        // 11. Transactions Page API (Database Collection Connection Fixed)
        app.get('/api/admin/transactions', async (req, res) => {
            try {
                const bookings = await db.collection('bookings').find({ paymentStatus: 'paid' }).toArray();

                if (!bookings || bookings.length === 0) {
                    return res.status(200).send({
                        success: true,
                        totalRevenue: 0,
                        payments: []
                    });
                }

                const payments = [];
                let totalRevenue = 0;

                bookings.forEach(booking => {

                    const currentPrice = booking.price ? Number(booking.price) : 0;

                    payments.push({
                        _id: booking._id,
                        userEmail: booking.userEmail || 'unknown@user.com',
                        price: currentPrice,
                        transactionId: booking.sessionId || 'N/A',
                        bookedAt: booking.bookedAt || new Date().toISOString()
                    });

                    totalRevenue += currentPrice;
                });

                console.log(`Server final balance calculated - Total: ${totalRevenue}, Payments count: ${payments.length}`);

                res.status(200).send({
                    success: true,
                    totalRevenue,
                    payments
                });

            } catch (error) {
                console.error('Admin Dashboard - Transactions API Error', error);

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error!',
                    error: error.message
                });
            }
        });



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

        // All Approved classes find and search or category api with Server-side Pagination
        app.get('/api/classes', async (req, res) => {
            try {
                const { search, category } = req.query;

                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 9;
                const skip = (page - 1) * limit;

                let query = { status: 'approved' };

                if (search) {
                    query.className = { $regex: search, $options: 'i' };
                }

                if (category && category !== 'All') {
                    query.category = category;
                }

                const totalClasses = await classesCollection.countDocuments(query);

                const result = await classesCollection.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.status(200).send({
                    success: true,
                    totalClasses,
                    totalPage: Math.ceil(totalClasses / limit),
                    data: result
                });

            } catch (error) {
                console.error('Get Classes API Error:', error);

                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });

        // ALL Community Forum Page - with Server-side Pagination (Public) 
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
                    data: {
                        posts: forumPostsData,
                        totalPage: Math.ceil(totalPosts / limit),
                        totalPosts
                    }
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

        // Community forum Single Posts Details Page (Private)
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

        // Like OR Dislike forum post (Private api)
        app.patch('/api/forum-posts/like/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { userEmail, voteType } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid ID Format'
                    })
                }

                const post = await forumPostCollection.findOne({ _id: new ObjectId(id) })

                if (!post) {
                    return res.status(404).send({
                        success: false,
                        message: 'Post not found'
                    })
                }

                const likes = post.like || [];
                const dislikes = post.dislike || [];

                let updateDoc = {};
                let statusMessage = '';

                if (voteType === 'like') {
                    if (likes.includes(userEmail)) {
                        updateDoc = { $pull: { like: userEmail } };
                        statusMessage = 'Like removed';

                    } else {
                        updateDoc = {
                            $addToSet: { like: userEmail },
                            $pull: { dislike: userEmail }
                        };
                        statusMessage = 'Post liked!';
                    }

                } else if (voteType === 'dislike') {
                    if (dislikes.includes(userEmail)) {
                        updateDoc = { $pull: { dislike: userEmail } };
                        statusMessage = 'Dislike removed';

                    } else {
                        updateDoc = {
                            $addToSet: { dislike: userEmail },
                            $pull: { like: userEmail }
                        };
                        statusMessage = 'Post disliked!';
                    }

                } else {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid Vote Type'
                    });
                }

                const result = await forumPostCollection.updateOne({ _id: new ObjectId(id) }, updateDoc)

                res.status(200).send({
                    success: true,
                    message: statusMessage,
                    data: result
                })

            } catch (error) {
                console.error('Like OR Dislike forum post API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })


        /*** FORUM POST COMMENTS & REPLIES SECTION ***/

        // ADD Comment Forum API
        app.patch('/api/forum-posts/comment/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { userName, userEmail, userImage, text } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid ID Format'
                    })
                }

                const newComment = {
                    commentId: new ObjectId(),
                    userName,
                    userEmail,
                    userImage,
                    text,
                    replies: [],
                    createdAt: new Date()
                }

                const result = await forumPostCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { comments: newComment } }
                )

                res.status(200).send({
                    success: true,
                    message: 'Comments posted successfully',
                    data: newComment,
                    modifiedCount: result.modifiedCount
                })

            } catch (error) {
                console.error('ADD Comment API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Comments Reply API
        app.patch('/api/forum-posts/comment/reply/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { commentId, userName, userEmail, userImage, text } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invaild ID Format'
                    })
                }

                const newReply = {
                    replyId: new ObjectId(),
                    userName,
                    userEmail,
                    userImage,
                    text,
                    createdAt: new Date()
                }

                const result = await forumPostCollection.updateOne(
                    { _id: new ObjectId(id), "comments.commentId": new ObjectId(commentId) },
                    { $push: { "comments.$.replies": newReply } }
                )

                res.status(200).send({
                    success: true,
                    message: 'Reply added successfully',
                    data: newReply,
                    modifiedCount: result.modifiedCount
                })

            } catch (error) {
                console.error('Comment Reply API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // Edit users own comment
        app.patch('/api/forum-posts/comment/edit/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { commentId, userEmail, newText } = req.body;

                if (!ObjectId.isValid(id) || !ObjectId.isValid(commentId)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid ID Format'
                    })
                }

                const result = await forumPostCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                        "comments.commentId": new ObjectId(commentId),
                        "comments.userEmail": userEmail
                    },
                    { $set: { "comments.$.text": newText } }
                )

                if (result.modifiedCount > 0) {
                    res.status(200).send({
                        success: true,
                        message: 'Comment updated successfully',
                        data: result.modifiedCount
                    });
                } else {
                    res.status(403).send({
                        success: false,
                        message: 'Unauthorized or Comment not found'
                    });
                }

            } catch (error) {
                console.error('Edit users own comment API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // delete Own comment api
        app.patch('/api/forum-posts/comment/delete/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { commentId, userEmail } = req.body;

                if (!ObjectId.isValid(id) || !ObjectId.isValid(commentId)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid ID Format'
                    });
                }

                const result = await forumPostCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $pull: {
                            comments: {
                                commentId: new ObjectId(commentId),
                                userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') }
                            }
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    return res.status(200).send({
                        success: true,
                        message: "Comment Deleted Successfully",
                        deleteCount: result.modifiedCount
                    });
                } else {
                    return res.status(403).send({
                        success: false,
                        message: 'Unauthorized Comment not found!'
                    });
                }

            } catch (error) {
                console.error('Delete Own comment api Error', error);
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                });
            }
        });

        /**** Favorite Add OR Remove API Section *****/

        // Favorite: Add or Remove api
        app.post('/api/favorites', async (req, res) => {
            try {
                const { classId, userEmail, className, image, category } = req.body;

                const isExist = await favoritesCollection.findOne({ classId, userEmail });

                if (isExist) {
                    await favoritesCollection.deleteOne({ classId, userEmail });
                    return res.status(200).send({
                        success: true,
                        isFavorite: false,
                        message: 'Removed from your favorites successfully!'
                    });
                }

                const favoriteDoc = {
                    classId,
                    userEmail,
                    className,
                    image,
                    category,
                    addedAt: new Date()
                };

                await favoritesCollection.insertOne(favoriteDoc);

                res.status(201).send({
                    success: true,
                    isFavorite: true,
                    message: 'Successfully added to your favorites!'
                });

            } catch (error) {
                console.error('Favorite Toggle API Error:', error);

                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });

        //  Check Favorited by User
        app.get('/api/favorites/check', async (req, res) => {
            try {
                const { classId, userEmail } = req.query;

                const isExist = await favoritesCollection.findOne({ classId, userEmail });

                if (isExist) {
                    return res.status(200).send({
                        isFavorite: true
                    });
                } else {
                    return res.status(200).send({
                        isFavorite: false
                    });
                }

            } catch (error) {
                console.error('favorites check api error', error)

                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });


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

        // user overview api
        app.get('/user-overview', async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({
                        message: 'Email is required'
                    });
                }

                const user = await usersCollection.findOne({ email: email });

                if (!user) {
                    return res.status(404).send({
                        message: 'User not found'
                    });
                }

                const totalBooked = await bookingsCollection.countDocuments({ userEmail: email });

                const totalFavorites = await favoritesCollection.countDocuments({ userEmail: email });

                res.status(200).send({
                    stats: {
                        totalBooked,
                        totalFavorites
                    },
                    profile: {
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        role: user.role || 'user'
                    },
                    trainerApplication: {
                        status: user.trainerStatus || 'none',
                        feedback: user.adminFeedback || null
                    }
                });

            } catch (error) {
                res.status(500).send({
                    message: 'Internal server error',
                    error: error.message
                });
            }
        });

        // user booked classes list api
        app.get('/booked-classes', async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) {
                    return res.status(400).send({
                        message: 'Email is required'
                    });
                }

                const userBookings = await bookingsCollection.find({ userEmail: email }).sort({ bookedAt: -1 }).toArray();

                if (userBookings.length === 0) {
                    return res.send([]);
                }

                const detailedBookings = [];

                for (const booking of userBookings) {
                    let query = {};
                    if (ObjectId.isValid(booking.classId)) {
                        query = { _id: new ObjectId(booking.classId) };
                    } else {
                        query = { _id: booking.classId };
                    }

                    const originalClass = await classesCollection.findOne(query);

                    detailedBookings.push({
                        bookingId: booking._id,
                        classId: booking.classId,
                        className: booking.className || (originalClass ? originalClass.className : 'N/A'),
                        image: booking.image || (originalClass ? originalClass.image : ''),
                        category: booking.category || (originalClass ? originalClass.category : 'Fitness Focus'),
                        trainerName: originalClass ? originalClass.trainerName : 'Expert Trainer',
                        trainerEmail: originalClass ? originalClass.trainerEmail : '',
                        scheduleDays: originalClass ? originalClass.scheduleDays : [],
                        time: originalClass ? originalClass.time : 'Flexible',
                        price: originalClass ? originalClass.price : 0,
                        bookingDate: booking.bookedAt
                    });
                }

                res.status(200).send(detailedBookings);

            } catch (error) {
                res.status(500).send({
                    message: 'Internal server error',
                    error: error.message
                });
            }
        })

        // User Dashboard -  GET All favorites list
        app.get('/api/favorites/:email', async (req, res) => {
            try {
                const email = req.params.email

                const query = { userEmail: email }
                const result = await favoritesCollection.find(query).sort({ addedAt: -1 }).toArray()

                res.status(200).send({
                    success: true,
                    message: 'favorites collection list fetched successfully',
                    data: result
                })

            } catch (error) {
                console.error('Get favorites dashboard API Error', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // User Dashboard - Favorites Class delete api
        app.delete('/api/favorites/delete/:id', async (req, res) => {
            try {
                const id = req.params.id

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        success: false,
                        message: 'Invalid ID Format'
                    })
                }

                const result = await favoritesCollection.deleteOne({ _id: new ObjectId(id) })

                if (result.deletedCount > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Favorites deleted successfully!"
                    })
                } else {
                    res.status(404).send({
                        success: false,
                        message: 'Class not found in favorites'
                    })
                }

            } catch (error) {
                console.error('Delete favorite dashboard API Error:', error)
                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error! Something Wrong!',
                    error: error.message,
                })
            }
        })

        // apply Trainer application api
        app.patch('/api/user/apply-trainer', async (req, res) => {
            try {
                const { email, experience, specialty, bio } = req.body;

                if (!email) {
                    return res.status(400).send({
                        success: false,
                        message: 'User email is required'
                    });
                }

                const filter = { email: email };

                const updateDoc = {
                    $set: {
                        trainerStatus: 'pending',
                        trainerApplication: {
                            experience: parseInt(experience) || 0,
                            specialty,
                            bio,
                            appliedAt: new Date()
                        }
                    }
                };

                const result = await usersCollection.updateOne(filter, updateDoc);

                if (result.modifiedCount > 0) {
                    res.status(200).send({
                        success: true,
                        message: 'Your application submitted. Wait Admin approval!'
                    });
                } else {
                    res.status(404).send({ success: false, message: 'User account not found' });
                }

            } catch (error) {
                console.error('Apply Trainer PATCH API Error:', error);

                res.status(500).send({
                    success: false,
                    message: 'Internal Server Error',
                    error: error.message
                });
            }
        });





        /******PAYMENT API******/

        // booked check api
        app.get('/api/bookings/check', async (req, res) => {
            try {
                const { email, classId } = req.query;

                if (!email || !classId) {
                    return res.status(400).json({
                        success: false,
                        message: "Email and classId are required"
                    });
                }

                const isBooked = await bookingsCollection.findOne({
                    userEmail: email,
                    classId: classId
                });

                if (isBooked) {
                    return res.json({
                        success: true,
                        booked: true
                    });
                } else {
                    return res.json({
                        success: true,
                        booked: false
                    });
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });

        // payment save to database
        app.post('/api/bookings/save', async (req, res) => {
            try {

                const { sessionId, classId, userEmail, price } = req.body;

                if (!sessionId || !classId || !userEmail) {
                    return res.status(400).json({
                        success: false,
                        message: "Missing fields"
                    });
                }

                const existing = await bookingsCollection.findOne({ sessionId });

                if (existing) {
                    return res.status(200).json({
                        success: true,
                        message: "Already recorded"
                    });
                }

                const newBooking = {
                    sessionId,
                    classId,
                    userEmail,
                    price: price ? Number(price) : 0,
                    paymentStatus: 'paid',
                    bookedAt: new Date()
                };

                await bookingsCollection.insertOne(newBooking);

                await classesCollection.updateOne(
                    { _id: new ObjectId(classId) },
                    { $inc: { bookingCount: 1 } }
                );

                res.status(201).json({
                    success: true,
                    message: "Booking saved!"
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });



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