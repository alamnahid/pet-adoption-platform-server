const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    // 'https://letsskillsup.web.app',
    // 'https://letsskillsup.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vgt34f5.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const petCollection = client.db("petDonation").collection("addapet")
    const usersCollection = client.db("petDonation").collection("users")
    const adoptionCollection = client.db("petDonation").collection("adoptionreq")
    const donationCampaignCollection = client.db("petDonation").collection("adddonationcamp")

    // jwt related apis

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middle wares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // pet collection post api 

    app.post('/addapet', async (req, res) => {
      const item = req.body;
      const result = await petCollection.insertOne(item);
      res.send(result)
    })


    app.get('/addapet/v1', async (req, res) => {
      let query = {};
      const petName = req.query.petName;
      const email = req.query.email;
      const category = req.query.category;

      if (petName) {
        query.petName = petName;
      }
      if (email) {
        query.email = email;
      }
      let sortCriteria = { dateTime: -1 };

      if (category) {
        query.petCategory = category;
        sortCriteria = { petCategory: 1 };
      }

      const cursor = petCollection.find(query).sort(sortCriteria);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get('/addapet/v1/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petCollection.findOne(query);
      res.send(result);
    })

    app.get('/addapet/email', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const totalCount = await petCollection.countDocuments(query);
      res.send({ totalCount });
    })
    app.get('/addapet/adminroute', verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log(req.headers)
      const result = await petCollection.find().skip(page * size)
        .limit(size).toArray()
      res.send(result)
    })

    app.get('/addapet', async (req, res) => {
      const count = await petCollection.estimatedDocumentCount();
      res.send({ count });
    })

    app.get('/addapet/adminroute/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await petCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    app.patch('/addapet/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          petName: item.petName,
          petAge: item.petAge,
          petLocation: item.petLocation,
          shortDescription: item.shortDescription,
          longDescription: item.longDescription,
        }
      }

      const result = await petCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/addapet/status/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          adopted: item.adopted,
        }
      }

      const result = await petCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    app.delete('/addapet/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petCollection.deleteOne(query)
      res.send(result);
    })

    app.get('/addapet/adminroute/approved', async (req, res) => {

      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const filter = req.query;
      const query = {
        title: { $regex: filter.search || '', $options: 'i' },

      }


      let sortObj = {}
      const sortField = req.query.sortField
      const sortOrder = req.query.sortOrder
      if (sortField && sortOrder) {
        sortObj[sortField] = sortOrder
      }

      const result = await petCollection.find({ status: 'approved', ...query }).sort(sortObj).skip(page * size)
        .limit(size).toArray()
      res.send(result)
    })

    app.get('/addapet', async (req, res) => {
      const count = await petCollection.countDocuments({ status: 'approved' });
      res.send({ count });
    })

    app.get('/addapet/adminroute/approved/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petCollection.findOne(query);
      res.send(result);
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers)
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      const filter = req.query;
      const query = {
        name: { $regex: filter.search || '', $options: 'i' },

      }
      const result = await usersCollection.find(query).skip(page * size)
        .limit(size).toArray()
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)

    })


    app.post('/adoptionreq/v1', async (req, res) => {
      const newPet = req.body;
      const result = await adoptionCollection.insertOne(newPet);
      res.send(result);
    })


    // add donation campaign
    app.post('/adddonationcamp', async (req, res) => {
      const item = req.body;
      const result = await donationCampaignCollection.insertOne(item);
      res.send(result)
    })

    app.get('/adddonationcamp/v1', async (req, res) => {
      let query = {};
      const petName = req.query.petName;
      const email = req.query.email;
      const category = req.query.category;

      if (petName) {
        query.petName = petName;
      }
      if (email) {
        query.email = email;
      }
      let sortCriteria = { dateTime: -1 };

      if (category) {
        query.petCategory = category;
        sortCriteria = { petCategory: 1 };
      }

      const cursor = donationCampaignCollection.find(query).sort(sortCriteria);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/adddonationcamp/v1/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await donationCampaignCollection.findOne(query);
      res.send(result);
    })

    app.get('/adddonationcamp/email', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const totalCount = await donationCampaignCollection.countDocuments(query);
      res.send({ totalCount });
    })
    



  } finally {
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('pet adoption server is running')
})
app.listen(port, () => {
  console.log(`pet adoption is sitting on port ${port}`);
})