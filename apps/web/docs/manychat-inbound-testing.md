# Manychat Bridge Configuration

## Required Env Defaults

These are server-only fallback values. Leave them empty for local mock testing.

```bash
MANYCHAT_BRIDGE_OUTBOUND_URL=https://your-bridge.example.com/manychat/outbound
MANYCHAT_BRIDGE_TOKEN=your-server-token
MANYCHAT_BRIDGE_SECRET=your-shared-inbound-secret
MANYCHAT_OUTBOUND_INTERNAL_TOKEN=your-internal-route-token
```

Legacy `MANYCHAT_OUTBOUND_API_URL` and `MANYCHAT_OUTBOUND_API_TOKEN` are still read as fallback for outbound only.

## Local Test Mode

In local development, this payload works without a real Manychat hotel/channel record:

- `hotel_id = "demo-hotel"`
- `secret = "test-secret"`

If live ops is configured, the webhook bridges into the existing demo conversation ingestion flow. If live ops is not configured, it returns mock success instead of throwing a server error.

Local mock conversation events are persisted across dev server restarts in:

```text
apps/web/.tugobo-dev/manychat-dev-events.json
```

The file is gitignored and stores only dev conversation event fields needed by the panel. It does not store shared secrets, internal tokens, outbound tokens, or phone numbers.

To reset local mock events, either delete that file or call this dev-only endpoint:

```powershell
Invoke-RestMethod `
  -Method Delete `
  -Uri "http://localhost:3000/api/integrations/manychat/dev-events"
```

## Webhook URL

```text
POST https://<app-host>/api/integrations/manychat/inbound
```

## Example Payload

Use `apps/web/examples/manychat-inbound.payload.json`.

## PowerShell Tests

```powershell
$body = Get-Content apps/web/examples/manychat-inbound.payload.json -Raw

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/integrations/manychat/inbound" `
  -ContentType "application/json" `
  -Body $body
```

Wrong secret check:

```powershell
$body = @{
  hotel_id = "demo-hotel"
  secret = "wrong-secret"
  provider = "manychat"
  channel = "instagram"
  external_user_id = "ig_123"
  guest_name = "Test Guest"
  message = "Merhaba"
} | ConvertTo-Json

Invoke-WebRequest `
  -Method Post `
  -Uri "http://localhost:3000/api/integrations/manychat/inbound" `
  -ContentType "application/json" `
  -Body $body
```

Expected status is `403`.

## Hotel/Channel Configuration

For non-demo payloads, configure one row per hotel/channel:

- `hotels.id = <hotel_id>`
- `connected_channels.provider = "manychat"`
- `connected_channels.channel_type = "instagram"` or `whatsapp`
- `connected_channels.status = "connected"`
- `connected_channels.inbound_secret = "<shared webhook secret>"`
- `connected_channels.outbound_url = "https://your-bridge.example.com/manychat/outbound"`
- `connected_channels.outbound_token = "<server bridge token>"`
- `connected_channels.external_account_id = "<manychat workspace/account id>"`
- `connected_channels.metadata = { ... }`

`connected_channels.secret` and metadata keys such as `inboundSecret`, `outboundUrl`, and `outboundToken` are still supported for compatibility, but the explicit columns are preferred.

## Resolution Order

1. Connected `manychat` channel for the hotel/channel.
2. `MANYCHAT_BRIDGE_*` env defaults.
3. Local `demo-hotel` mock mode outside production.
