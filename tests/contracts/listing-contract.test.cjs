const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const YAML = require('yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// These are schema tests, not HTTP, authorization or PostgreSQL integration tests.
const document = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/contracts/listings.openapi.yaml'), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(document, 'listing-contract');
function validates(name, schema, value, expected = true) {
  test(`listing: ${name}`, () => {
    const validate = ajv.getSchema(`listing-contract#/components/schemas/${schema}`);
    assert.ok(validate, `Missing schema ${schema}`);
    assert.equal(validate(value), expected, JSON.stringify(validate.errors));
  });
}
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const common = { title: 'Synthetic listing', description: 'Synthetic description', categoryId: id, areaId: id };
const sell = { ...common, type: 'SELL', condition: 'USED_GOOD', price: 150000, mediaIds: [id] };
const buy = { ...common, type: 'BUY', budget: null, mediaIds: [] };
const exchange = { ...common, type: 'EXCHANGE', condition: 'USED_FAIR', exchangeWanted: 'Synthetic exchange request', mediaIds: [id] };
for (const [type, fixture] of [['SELL', sell], ['BUY', buy], ['EXCHANGE', exchange]]) {
  validates(`${type} valid input`, 'CreateListingRequest', fixture);
  validates(`${type} unknown owner cannot be injected`, 'CreateListingRequest', { ...fixture, ownerId: otherId }, false);
  validates(`${type} unknown status cannot be injected`, 'CreateListingRequest', { ...fixture, status: 'COMPLETED' }, false);
}
validates('BUY optional user budget serializes as null', 'CreateListingRequest', buy);
validates('BUY cannot accept condition from another type', 'CreateListingRequest', { ...buy, condition: 'USED_GOOD' }, false);
validates('BUY budget cannot be a decimal', 'CreateListingRequest', { ...buy, budget: 1.5 }, false);
validates('SELL requires at least one image', 'CreateListingRequest', { ...sell, mediaIds: [] }, false);
validates('EXCHANGE requires at least one image', 'CreateListingRequest', { ...exchange, mediaIds: [] }, false);
validates('EXCHANGE requires desired item or conditions', 'CreateListingRequest', { ...exchange, exchangeWanted: '' }, false);
validates('images must be unique', 'CreateListingRequest', { ...sell, mediaIds: [id, id] }, false);
validates('media identifiers must be UUIDs', 'CreateListingRequest', { ...sell, mediaIds: ['not-a-uuid'] }, false);
validates('price cannot be negative', 'CreateListingRequest', { ...sell, price: -1 }, false);
validates('price accepts integer VND upper bound', 'CreateListingRequest', { ...sell, price: 1000000000 });
validates('price rejects beyond upper bound', 'CreateListingRequest', { ...sell, price: 1000000001 }, false);
validates('SELL cannot omit price', 'CreateListingRequest', Object.fromEntries(Object.entries(sell).filter(([key]) => key !== 'price')), false);
validates('title counts Unicode code points', 'CreateListingRequest', { ...sell, title: '\u{1f600}'.repeat(120) });
validates('title rejects beyond Unicode limit', 'CreateListingRequest', { ...sell, title: '\u{1f600}'.repeat(121) }, false);
validates('description rejects beyond limit', 'CreateListingRequest', { ...sell, description: 'x'.repeat(5001) }, false);
validates('empty title rejected', 'CreateListingRequest', { ...sell, title: '' }, false);
validates('title accepts design minimum of ten code points', 'CreateListingRequest', { ...sell, title: 'x'.repeat(10) });
validates('title below design minimum rejected', 'CreateListingRequest', { ...sell, title: 'x'.repeat(9) }, false);
validates('type cannot be arbitrary', 'CreateListingRequest', { ...sell, type: 'AUCTION' }, false);
validates('update requires expected version', 'UpdateListingRequest', sell, false);
validates('full update includes optimistic version', 'UpdateListingRequest', { ...sell, expectedVersion: 1 });
validates('zero version is invalid', 'UpdateListingRequest', { ...sell, expectedVersion: 0 }, false);
validates('transition never accepts raw status', 'TransitionRequest', { action: 'COMPLETE', expectedVersion: 2, status: 'COMPLETED' }, false);
validates('transition COMPLETE valid shape', 'TransitionRequest', { action: 'COMPLETE', expectedVersion: 2 });
validates('transition cannot reopen admin-removed listing', 'TransitionRequest', { action: 'REOPEN', expectedVersion: 2 }, false);
for (const status of ['OPEN', 'CLOSED']) {
  validates(`${status} has no completion result`, 'Lifecycle', { status, completion: null, removalActor: null });
  validates(`${status} cannot claim SOLD`, 'Lifecycle', { status, completion: 'SOLD', removalActor: null }, false);
}
validates('removed lifecycle identifies administrator', 'Lifecycle', { status: 'REMOVED', completion: null, removalActor: 'ADMIN' });
validates('removed lifecycle requires actor', 'Lifecycle', { status: 'REMOVED', completion: null, removalActor: null }, false);
validates('completed lifecycle requires result', 'Lifecycle', { status: 'COMPLETED', completion: null, removalActor: null }, false);
const owner = { id, displayName: 'Synthetic owner', avatarUrl: null };
const listing = { type: 'SELL', title: sell.title, description: sell.description, condition: sell.condition, price: sell.price,
  id, category: { id, name: 'Synthetic category' }, area: { id, name: 'Synthetic area' },
  images: [{ id, url: 'https://example.invalid/image.webp', width: 100, height: 100 }], owner,
  lifecycle: { status: 'OPEN', completion: null, removalActor: null }, version: 1,
  createdAt: '2026-11-14T00:00:00Z', updatedAt: '2026-11-14T00:00:00Z' };
validates('public-safe listing projection', 'Listing', listing);
for (const field of ['email', 'passwordHash', 'token', 'schoolEmail', 'address']) {
  validates(`owner projection excludes ${field}`, 'Listing', { ...listing, owner: { ...owner, [field]: 'private' } }, false);
}
validates('listing excludes provider storage reference', 'Listing', { ...listing, avatarPublicId: 'private-reference' }, false);
validates('listing image requires HTTPS', 'Listing', { ...listing, images: [{ ...listing.images[0], url: 'http://example.invalid/image.webp' }] }, false);
validates('empty owner page has explicit null cursor', 'OwnerListingPage', { items: [], nextCursor: null });
validates('pagination requires next cursor field', 'OwnerListingPage', { items: [] }, false);
validates('owner page cannot exceed response limit', 'OwnerListingPage', { items: Array(51).fill(listing), nextCursor: null }, false);
const submission = { key: id, operation: 'CREATE', state: 'SUCCEEDED', listingId: id, resultVersion: 1, errorCode: null, replayUntil: '2026-11-16T00:00:00Z' };
validates('successful submission identifies durable result', 'SubmissionStatus', submission);
validates('successful submission cannot lack result', 'SubmissionStatus', { ...submission, listingId: null, resultVersion: null }, false);
validates('successful submission cannot carry failure', 'SubmissionStatus', { ...submission, errorCode: 'VALIDATION_ERROR' }, false);
validates('processing submission has no committed result', 'SubmissionStatus', { ...submission, state: 'PROCESSING', listingId: null, resultVersion: null });
validates('processing submission cannot claim committed result', 'SubmissionStatus', { ...submission, state: 'PROCESSING' }, false);
validates('failed submission has safe error and no result', 'SubmissionStatus', { ...submission, state: 'FAILED', listingId: null, resultVersion: null, errorCode: 'VALIDATION_ERROR' });
validates('failed submission cannot claim successful result', 'SubmissionStatus', { ...submission, state: 'FAILED', errorCode: 'VALIDATION_ERROR' }, false);
validates('expired known result remains referencable', 'SubmissionStatus', { ...submission, state: 'EXPIRED' });
validates('expired result references cannot be half-present', 'SubmissionStatus', { ...submission, state: 'EXPIRED', resultVersion: null }, false);

test('listing: mutation keys are required UUID headers, version is not client status', () => {
  const parameter = document.components.parameters.IdempotencyKey;
  assert.equal(parameter.name, 'Idempotency-Key');
  assert.equal(parameter.in, 'header');
  assert.equal(parameter.required, true);
  const validate = ajv.compile(parameter.schema);
  assert.equal(validate(id), true);
  assert.equal(validate('new-attempt'), false);
  for (const [pathname, method] of [['/listings', 'post'], ['/me/listings/{listingId}', 'put'], ['/me/listings/{listingId}/transitions', 'post']]) {
    assert.ok(document.paths[pathname][method].parameters.some(p => p.$ref === '#/components/parameters/IdempotencyKey'));
  }
});

test('listing: all operations are uniquely identified and catalog alone is anonymous', () => {
  const operationIds = [];
  assert.deepEqual(document.security, [{ bearerSession: [] }]);
  for (const [pathname, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
      operationIds.push(operation.operationId);
      if (pathname.startsWith('/catalog/')) assert.deepEqual(operation.security, []);
      else assert.equal(operation.security, undefined);
    }
  }
  assert.equal(new Set(operationIds).size, operationIds.length);
  assert.ok(operationIds.length >= 8);
});

test('listing: private and mutation success responses forbid HTTP caching', () => {
  for (const [pathname, methods] of Object.entries(document.paths)) {
    if (pathname.startsWith('/catalog/')) continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
      for (const [code, response] of Object.entries(operation.responses)) {
        if (!code.startsWith('2')) continue;
        const header = response.headers?.['Cache-Control'];
        assert.ok(header, `${method} ${pathname} ${code} needs Cache-Control`);
        const resolved = header.$ref ? document.components.headers[header.$ref.split('/').pop()] : header;
        assert.deepEqual(resolved.schema.enum, ['no-store']);
      }
    }
  }
});

test('listing: all component schemas and local references resolve', () => {
  for (const name of Object.keys(document.components.schemas)) assert.ok(ajv.getSchema(`listing-contract#/components/schemas/${name}`));
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') {
      assert.ok(value.$ref.startsWith('#/'), 'This baseline uses only local references');
      const result = value.$ref.slice(2).split('/').reduce((object, key) => object?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], document);
      assert.ok(result, `Unresolved ${value.$ref}`);
    }
    for (const nested of Object.values(value)) walk(nested);
  }
  walk(document);
});
