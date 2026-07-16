import { expect } from "@playwright/test";

export async function clearMailpit(mailpit) {
  const response = await mailpit.delete("/api/v1/messages");
  expect([200, 204]).toContain(response.status());
}

export async function listMailpitMessages(mailpit) {
  const response = await mailpit.get("/api/v1/messages");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return Array.isArray(body.messages) ? body.messages : [];
}

export async function waitForMailpitEmail(
  mailpit,
  { recipient, subject, urlPattern, excludedIds = [], timeout = 15_000 }
) {
  const excluded = new Set(excludedIds);
  let delivered = null;
  await expect
    .poll(
      async () => {
        const messages = await listMailpitMessages(mailpit);
        for (const summary of messages) {
          const id = messageId(summary);
          if (!id || excluded.has(id)) continue;
          if (!recipientAddresses(summary).includes(recipient)) continue;
          if (subject && summary.Subject !== subject) continue;

          const response = await mailpit.get(`/api/v1/message/${encodeURIComponent(id)}`);
          if (!response.ok()) continue;
          const detail = await response.json();
          const content = messageContent(detail);
          const url = content.match(urlPattern)?.[0] ?? "";
          if (!url) continue;
          delivered = { id, summary, detail, content, url, messages };
          return true;
        }
        return false;
      },
      {
        message: `${subject ?? "email"} for ${recipient}`,
        timeout,
        intervals: [100, 250, 500]
      }
    )
    .toBe(true);

  return delivered;
}

export function recipientAddresses(message) {
  const recipients = Array.isArray(message.To) ? message.To : [];
  return recipients
    .map((recipient) => recipient?.Address)
    .filter((address) => typeof address === "string");
}

export function messageContent(message) {
  return [message.Text, message.HTML, message.Html]
    .filter((value) => typeof value === "string")
    .join("\n")
    .replaceAll("&amp;", "&");
}

function messageId(message) {
  if (typeof message.ID === "string") return message.ID;
  return typeof message.Id === "string" ? message.Id : null;
}
