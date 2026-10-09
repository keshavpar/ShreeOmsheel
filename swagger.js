const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');


// Load environment variables
dotenv.config();

const env = process.env.NODE_ENV || 'development';

let port;
switch (env) {
  case 'development':
    port = process.env.DEVELOPMENTPORT;
    break;
  case 'testing':
    port = process.env.TEST_PORT;
    break;
  case 'production':
    port = process.env.PORT;
    break;
  default:
    port = 8001; // fallback
}

const hostUrl =
  env === 'production'
    ? process.env.PROD_SERVER_URL || 'https://your-production-url.com'
    : `https://localhost:${port}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Healthcare API',
      version: '1.0.0',
      description: 'API documentation for the healthcare system',
    },
    servers: [
      {
        url: hostUrl,
      },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'], // path to files with Swagger annotations
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec,
};
