const { copyFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const destination = resolve(__dirname, '../dist/shared/http');
mkdirSync(destination, { recursive: true });
copyFileSync(
  resolve(__dirname, '../../docs/contracts/accounts.openapi.yaml'),
  resolve(destination, 'accounts.openapi.yaml'),
);

copyFileSync(resolve(__dirname, '../../docs/contracts/listings.openapi.yaml'), resolve(destination, 'listings.openapi.yaml'));
