const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", require('./routes/base'));
app.use("/bg", require('./routes/bg'));

app.listen(3100, () => console.log('Server running at http://localhost:3100'));