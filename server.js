const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./docs/swagger.yaml');

dotenv.config({ path: './.env' });

const app = require('./app');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const env = process.env.NODE_ENV || 'development';

let dbConnectionString, port;

switch (env) {
  case 'development':
    dbConnectionString = process.env.DB_connection_String;
    port = process.env.DEVELOPMENTPORT || 443;
    break;
  case 'testing':
    dbConnectionString = process.env.TEST_DB_CONNECTION;
    port = process.env.TEST_PORT || 443;
    break;
  case 'production':
    dbConnectionString = process.env.PROD_DB_CONNECTION;
    port = process.env.PORT || 443;
    break;
  default:
    console.error('❌ Unknown NODE_ENV:', env);
    process.exit(1);
}

// DB Connection
mongoose
  .connect(dbConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ DB Connection Successful'))
  .catch((err) => console.error('❌ DB Connection Error:', err.message));

// Read SSL certs
const sslOptions = {
  key: fs.readFileSync('./ssl/key.pem'),
  cert: fs.readFileSync('./ssl/cert.pem'),
};

// Start HTTPS Server
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`🚀 HTTPS Server running at https://localhost:${port}`);
  console.log(`🌍 Environment: ${env}`);
});
