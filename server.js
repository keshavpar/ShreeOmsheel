const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

dotenv.config({ path: './.env' });

const swaggerDocument = YAML.load('./docs/swagger.yaml');
const app = require('./app');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const env = process.env.NODE_ENV || 'development';

let dbConnectionString;
const port = process.env.PORT || 3000;

switch (env) {
  case 'development':
    dbConnectionString = process.env.DB_connection_String;
    break;
  case 'testing':
    dbConnectionString = process.env.TEST_DB_CONNECTION;
    break;
  case 'production':
    dbConnectionString = process.env.PROD_DB_CONNECTION;
    break;
  default:
    console.error('❌ Unknown NODE_ENV:', env);
    process.exit(1);
}

mongoose
  .connect(dbConnectionString)
  .then(() => console.log('✅ DB Connection Successful'))
  .catch(err => {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  });

http.createServer(app).listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP Server running on port ${port}`);
  console.log(`🌍 Environment: ${env}`);
});
