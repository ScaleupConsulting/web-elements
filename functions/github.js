/**
 * Cloudflare Pages Function: GitHub webhook -> Mattermost relay.
 *
 * Ported from the legacy github.php that ran on SiteGround (PHP does not run on
 * Pages). Receives a GitHub org/repo webhook, formats a human-readable message
 * for the event type, and posts it to the Mattermost incoming webhook supplied
 * in the ?mattermost= query param.
 *
 * Served at /github. Configure the GitHub webhook payload URL as:
 *   https://web-elements.scaleupconsulting.com.au/github?mattermost=<mattermost-incoming-webhook-url>
 * with Content type: application/json.
 */

/**
 * Builds the Mattermost message text for a GitHub event, mirroring the legacy
 * github.php formatting so existing channels keep the same notification style.
 *
 * @param {string} eventType - value of the X-GitHub-Event header
 * @param {Record<string, any>} p - parsed webhook payload
 * @param {string} raw - raw request body, used as a fallback for unknown events
 * @returns {string} Markdown message for Mattermost
 */
function getText(eventType, p, raw) {
  if (eventType === 'ping') return 'ping from github.com';

  if (eventType === 'push') {
    const ref = p.ref;
    const refUrl = `${p.repository?.html_url}/tree/${ref}`;
    let text = `#### ${eventType} from github.com\n[${ref}](${refUrl})\n`;
    for (const commit of p.commits ?? []) {
      text += `[${commit.id}](${commit.url}) ${commit.message}\n`;
      for (const f of commit.added ?? []) text += `A ${f}\n`;
      for (const f of commit.modified ?? []) text += `M ${f}\n`;
      for (const f of commit.removed ?? []) text += `D ${f}\n`;
    }
    return text;
  }

  if (eventType === 'pull_request') {
    const pr = p.pull_request ?? {};
    return `#### ${p.action} pull request: [${pr.title}](${pr.html_url})\n${pr.body}\n`;
  }

  if (eventType === 'pull_request_review_comment') {
    const pr = p.pull_request ?? {};
    const c = p.comment ?? {};
    let text = `#### ${p.action} comment on pull request: [${pr.title}](${c.html_url})\n`;
    text += '```diff\n' + c.diff_hunk + '\n```\n';
    if (c.in_reply_to_id != null) {
      const replyUrl = String(c.html_url).replace(String(c.id), String(c.in_reply_to_id));
      text += `in reply to [${c.in_reply_to_id}](${replyUrl})\n`;
    }
    return text + `${c.body}\n`;
  }

  if (eventType === 'issues') {
    const i = p.issue ?? {};
    return `#### ${p.action} issue: [${i.title}](${i.html_url})\n${i.body}\n`;
  }

  if (eventType === 'issue_comment') {
    const i = p.issue ?? {};
    const c = p.comment ?? {};
    return `#### ${p.action} comment on issue: [${i.title}](${i.html_url})\n${c.body}\n`;
  }

  if (eventType === 'release') {
    const r = p.release ?? {};
    return `#### ${p.action} release: [${r.name}](${r.html_url})\n${r.body}\n`;
  }

  if (eventType === 'create') {
    return `#### ${eventType} ${p.ref_type}: ${p.ref}\n`;
  }

  return `#### ${eventType} from github.com\n` + '```json\n' + raw + '\n```';
}

/**
 * Handles the GitHub webhook POST and relays it to Mattermost.
 *
 * @param {{ request: Request }} context - Pages Function context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { request } = context;
  const mattermost = new URL(request.url).searchParams.get('mattermost');
  if (!mattermost) {
    return new Response('missing ?mattermost= query param', { status: 400 });
  }

  const eventType = request.headers.get('x-github-event') ?? '';
  const raw = await request.text();
  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    // Non-JSON body (e.g. form-encoded): fall through with empty payload.
  }

  const postData = {
    text: getText(eventType, payload, raw),
    username: payload.sender?.login,
    icon_url: payload.sender?.avatar_url,
  };

  const resp = await fetch(mattermost, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postData),
  });
  const body = await resp.text();
  return new Response(`response: ${body}\n`, { status: resp.ok ? 200 : 502 });
}
