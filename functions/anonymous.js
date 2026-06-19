/**
 * Cloudflare Pages Function: Mattermost `/anonymous` slash command.
 *
 * Ported from the legacy slash.scaleupconsulting.com.au/anonymous.php (SiteGround/PHP).
 * Posts the supplied text to a Mattermost channel through an incoming webhook with
 * no username, so the message appears anonymous, and echoes the text back as the
 * slash-command response shown to the invoking user.
 *
 * Served at /anonymous. The Mattermost incoming-webhook URL is read from the
 * MATTERMOST_ANON_WEBHOOK Pages environment variable so the secret stays out of git.
 */

/**
 * Reads slash-command params from the query string, falling back to a
 * form-encoded POST body (Mattermost can be configured to send either).
 *
 * @param {Request} request
 * @returns {Promise<URLSearchParams>}
 */
async function readParams(request) {
  const params = new URLSearchParams(new URL(request.url).search);
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      for (const [k, v] of new URLSearchParams(await request.text())) params.set(k, v);
    }
  }
  return params;
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
  const text = params.get('text') ?? '';
  const channel = params.get('channel_name') ?? '';

  const webhook = env.MATTERMOST_ANON_WEBHOOK;
  if (webhook) {
    // Post to the channel anonymously (no username override) via the incoming webhook.
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });
  }

  // Ephemeral slash-command response back to the invoking user.
  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet = handle;
export const onRequestPost = handle;
