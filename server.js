const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({path: './.env'});

const app = require('./app');

mongoose.connect(process.env.DB_connection_String, {
    UseNewUrlParser: true
}).then((conn) => {
    console.log("DB Connection Successful... :)");
}).catch((error) => {
    console.log(error.message);
})

console.log(process.NODE_ENV)
const port = process.env.PORT;
const dport=process.env.DEVELOPMENTPORT

app.listen(dport,()=>{
    console.log(`Server is running on ${dport}... :) `);
})