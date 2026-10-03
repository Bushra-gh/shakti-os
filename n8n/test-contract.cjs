// Offline validation only. Never imports/runs n8n or calls a webhook.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'shaktios-action-handoff.json'), 'utf8'));
const validate = new Function('$json', workflow.nodes.find(node => node.id === 'validate-action').parameters.jsCode);
const payload = { action_id: 'test-action', action_type: 'notify_operator', incident: { id: 'test-incident', status: 'RESPONDING' } };

test('workflow remains inactive, header-authenticated and acknowledgement-only', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.find(node => node.id === 'shaktios-webhook').parameters.authentication, 'headerAuth');
  assert.deepEqual(workflow.nodes.map(node => node.type).sort(), ['n8n-nodes-base.code', 'n8n-nodes-base.respondToWebhook', 'n8n-nodes-base.webhook']);
});

test('approved responding payload receives matching positive acknowledgement', () => {
  const result = validate({ body: payload })[0].json;
  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.action_id, payload.action_id);
  assert.equal(result.incident_id, payload.incident.id);
});

test('malformed/non-responding payloads are rejected, never marked accepted', () => {
  for (const invalid of [{}, { ...payload, action_id: [] }, { ...payload, action_type: ' ' }, { ...payload, incident: { id: 'test-incident', status: 'DETECTED' } }, { ...payload, note: 'x'.repeat(501) }]) {
    assert.equal(validate({ body: invalid })[0].json.ok, false);
  }
});
