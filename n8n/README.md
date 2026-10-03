# ShaktiOS n8n handoff

This folder contains an importable n8n workflow for the MVP action loop:

```text
Dashboard operator approval
  -> FastAPI POST /incidents/{id}/actions
  -> n8n Webhook
  -> validate action payload
  -> return accepted response
  -> FastAPI records action.requested in the timeline
```

The workflow intentionally does not send a real emergency notification. Add a
notification node (Slack, email, WhatsApp, SMS, etc.) after **Validate Approved
Action** only after configuring the required credential and approval policy.

## Import and activate

1. Open n8n.
2. Select **Workflows → Import from File**.
3. Import `shaktios-action-handoff.json`.
4. Create an n8n **Header Auth** credential named `ShaktiOS Webhook Secret`.
   Set the header name to `X-ShaktiOS-Webhook-Secret` and choose the same
   secret value you will use in FastAPI. Select this credential in the
   **ShaktiOS Webhook** node if the import did not preserve the selection.
5. Open the **ShaktiOS Webhook** node and copy its **Production URL** after
   saving the workflow. The path is `shaktios/action`.
6. Activate the workflow.
7. Set the FastAPI environment variables:

   ```text
   N8N_WEBHOOK_URL=https://YOUR_N8N_HOST/webhook/shaktios/action
   N8N_WEBHOOK_SECRET=<YOUR_SERVER_ONLY_WEBHOOK_SECRET>
   ```

8. Restart FastAPI. The API sends the secret as the
   `X-ShaktiOS-Webhook-Secret` header, and n8n Header Auth rejects requests
   with the wrong value. Do not expose the webhook URL publicly without auth.

## Test it

Sign in with an authorized operator account, then move an incident through
`DETECTED → ASSESSING → RESPONDING` before requesting an action. See the
[demo walkthrough](../docs/DEMO.md) for setup and citizen/status verification.

Then click **Review & approve → Approve action**. A successful result should:

- return `accepted` in the dashboard;
- appear in the n8n execution history;
- create an `action.requested` entry in the incident timeline.

## Troubleshooting failed approval handoffs

If FastAPI returns `503`, `N8N_WEBHOOK_URL` is missing. A `502` means the API did not receive a successful n8n acknowledgement; it does **not** prove the workflow never ran. The dashboard now includes a specific, sanitized diagnostic:

| Diagnostic | What to check |
| --- | --- |
| n8n HTTP `401` / `403` | Webhook node uses **Header Auth**, its selected credential header is `X-ShaktiOS-Webhook-Secret`, and its value matches backend `N8N_WEBHOOK_SECRET`. Check reverse-proxy/access restrictions too. |
| n8n HTTP `404` | Workflow is saved and activated/published. Copy the node's **Production URL**, not its temporary Test URL. The provided workflow path is `/webhook/shaktios/action`. |
| n8n HTTP `405` | Webhook node's HTTP Method must be **POST**. |
| n8n HTTP `429` | Check execution history, then wait for n8n's rate limit to clear. |
| n8n HTTP `5xx` / other status | Open **Executions**, inspect the failed node, and check the Webhook response configuration. The provided workflow uses **Using Respond to Webhook Node**, with **Respond to ShaktiOS** connected after validation. |
| Connection failure | n8n must be reachable from the FastAPI machine/container; check the host, port and TLS configuration. |
| Timeout / network interruption | Check **Executions before retrying**. The workflow may already have run, but its response was not received within the API's 10-second timeout. |

After changing `N8N_WEBHOOK_URL` or `N8N_WEBHOOK_SECRET`, restart FastAPI. Do not change the Supabase JWT key; it is unrelated to n8n Header Auth.

Inspect n8n execution history for the incident ID/action before retrying. There is no automatic retry or exactly-once delivery guarantee. A failed handoff does not resolve the incident or create a successful `action.requested` timeline entry. If an execution already succeeded, verify its outcome before submitting another approval.

`GET /healthz` on the n8n host can confirm basic reachability without sending a webhook. A healthy server does not prove this particular workflow is active or that Header Auth is correct. The API's `/integrations` endpoint likewise reports configuration presence, not a live delivery test.
