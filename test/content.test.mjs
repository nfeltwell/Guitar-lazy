import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from '../scripts/check-content.mjs';

test('content audit finds no problems', () => {
  const errors = audit();
  assert.deepEqual(errors, []);
});
