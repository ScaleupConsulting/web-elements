/**
 * Cloudflare Pages Function: Mattermost `/anonymous` slash command.
 *
 * Ported from the legacy slash.scaleupconsulting.com.au/anonymous.php (SiteGround/PHP).
 * Posts the supplied text to a Mattermost channel through an incoming webhook with
 * no username, so the message appears anonymous, and echoes the text back as the
 * slash-command response shown to the invoking user.
 *
 * Served at /anonymous. Incoming-webhook URLs are read from the
 * MATTERMOST_ANON_WEBHOOKS Pages environment variable so the secrets stay out of
 * git. It holds a JSON object keyed by the slash command's own token:
 *
 *   {"<slash command token>": "https://chat.example.com/hooks/<webhook id>"}
 *
 * Keying on the token serves two purposes at once. Mattermost incoming webhooks
 * are team-scoped (the `channel` field is resolved against the webhook's own team,
 * see server/channels/app/webhook.go), so each team that installs `/anonymous`
 * needs its own webhook and the right one has to be picked per request. The token
 * is also the only shared secret Mattermost sends, so requiring a known token
 * stops anyone who knows the public URL from posting into these channels.
 */

/**
 * Returns the last value for a query/form parameter, or '' when absent.
 *
 * Mattermost APPENDS its parameters to the configured command URL rather than
 * replacing them, so a command registered as `.../anonymous?text=` arrives as
 * `?text=&...&text=<message>` with two `text` values. The legacy PHP read these
 * with $_GET, which keeps the LAST value; URLSearchParams.get() returns the FIRST,
 * which silently reduced every message to the empty string. Reading the last value
 * restores the PHP behaviour and works whether or not the registered URL carries a
 * trailing `?text=`.
 *
 * @param {URLSearchParams} params
 * @param {string} name
 * @returns {string}
 */
function lastValue(params, name) {
  const values = params.getAll(name);
  return values.length > 0 ? values[values.length - 1] : '';
}

/**
 * Reads slash-command params from the query string, merging in a form-encoded
 * POST body (Mattermost can be configured to send either GET or POST).
 *
 * @param {Request} request
 * @returns {Promise<URLSearchParams>}
 */
async function readParams(request) {
  const params = new URLSearchParams(new URL(request.url).search);
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      for (const [k, v] of new URLSearchParams(await request.text())) params.append(k, v);
    }
  }
  return params;
}

/**
 * Builds the ephemeral slash-command response shown only to the invoking user.
 *
 * @param {string} text
 * @returns {Response}
 */
function ephemeral(text) {
  return new Response(JSON.stringify({ text, response_type: 'ephemeral' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handles the slash command for both GET and POST configurations.
 *
 * @param {{ request: Request, env: Record<string, string> }} context
 * @returns {Promise<Response>}
 */
async function handle(context) {
  const { request, env } = context;
  const params = await readParams(request);
  const text = lastValue(params, 'text');
  const channel = lastValue(params, 'channel_name');
  const token = lastValue(params, 'token');

  // Fail loudly rather than posting nothing: a silent webhook failure is what made
  // the original port look like a working endpoint while every message vanished.
  if (text === '') {
    return ephemeral('Nothing to send. Usage: `/anonymous [message]`');
  }

  const webhooks = JSON.parse(env.MATTERMOST_ANON_WEBHOOKS);
  const webhook = webhooks[token];
  if (!webhook) {
    return ephemeral(
      'This `/anonymous` command is not configured for an incoming webhook. ' +
        'Each team needs its own webhook registered against its slash-command token.',
    );
  }

  // Post to the channel anonymously (the webhook itself supplies the display name).
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text }),
  });

  if (!response.ok) {
    return ephemeral(
      `Could not post anonymously (webhook returned ${response.status}): ${await response.text()}`,
    );
  }

  return ephemeral(text);
}

export const onRequestGet = handle;
export const onRequestPost = handle;
