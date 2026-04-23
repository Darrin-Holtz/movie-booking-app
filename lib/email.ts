type AppEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export const sendAppEmail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
}: AppEmailArgs) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!to) {
    return { delivered: false as const, reason: "missing-recipient" };
  }

  if (!apiKey || !from) {
    console.info("Email delivery skipped because RESEND_API_KEY or EMAIL_FROM is missing.", {
      to,
      subject,
      text,
    });

    return { delivered: false as const, reason: "missing-config" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Email delivery failed: ${details}`);
  }

  return { delivered: true as const };
};
