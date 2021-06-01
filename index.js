const cors = require('cors');
const express = require('express');
const connectDB = require('./db/db');

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());

// for image uploading in admin page
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/user', require('./routes/user'));
app.use('/auth', require('./routes/auth'));
app.use('/course', require('./routes/course'));

connectDB();
app.listen(PORT, () => console.log('Server running!'));
