require('dotenv').config();
require('ts-node/register');
const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const outputFile = path.join(__dirname, 'src', 'swagger-output.json');
const endpointsFiles = [path.join(__dirname, 'src', 'index.ts')];

const doc = {
  info: {
    title: 'Shopdee API',
    version: '1.0.0',
    description: 'Auto-generated Swagger documentation for Shopdee backend',
  },
  host: `localhost:${process.env.HOST_PORT || 4000}`,
  schemes: ['http'],
};

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('Generated', outputFile);
}).catch((err) => {
  console.error('swagger-autogen error:', err);
  process.exitCode = 1;
});
