const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

const app = require('./app');

// Determine environment
const env = process.env.NODE_ENV || 'development';

// Determine DB connection string and port based on environment
let dbConnectionString;
let port;

switch (env) {
  case 'development':
    dbConnectionString = process.env.DEV_DB_CONNECTION;
    port = process.env.DEVELOPMENT_PORT;
    break;
  case 'testing':
    dbConnectionString = process.env.TEST_DB_CONNECTION;
    port = process.env.TEST_PORT;
    break;
  case 'production':
    dbConnectionString = process.env.PROD_DB_CONNECTION;
    port = process.env.PORT;
    break;
  default:
    console.error('❌ Unknown NODE_ENV:', env);
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(dbConnectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ DB Connection Successful...');
  })
  .catch((error) => {
    console.error('❌ DB Connection Error:', error.message);
  });

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}...`);
  console.log(`🌍 Environment: ${env}`);
});
