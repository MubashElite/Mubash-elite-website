const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (clean(input.websiteTrap, 200)) {
    return json({ error: "Unable to process this request." }, 400);
  }

  const name = clean(input.name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const website = clean(input.website, 300);
  const country = clean(input.country, 100);
  const category = clean(input.category, 120);
  const stage = clean(input.stage, 100);
  const area = clean(input.area, 120);
  const description = clean(input.description, 4000);
  const budget = clean(input.budget, 80);
  const contact = clean(input.contact, 80);

  if (!name || !email || !stage || !area || !description) {
    return json({ error: "Please complete all required fields." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please provide a valid business email." }, 400);
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return json({ error: "Store URL must begin with https:// or http://." }, 400);
  }
  if (description.length < 15) {
    return json({ error: "Please provide a little more detail about your project." }, 400);
  }

  const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY;
  if (!apiKey) {
    return json({
      error: "The inquiry service is not configured yet. Please email info@mubashelite.com directly.",
    }, 503);
  }

  const message = [
    "A new project inquiry was submitted through the Mubash Elite website.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Store: ${website || "Not provided"}`,
    `Country: ${country || "Not provided"}`,
    `Category: ${category || "Not provided"}`,
    `Stage: ${stage}`,
    `Priority: ${area}`,
    `Budget: ${budget || "Not provided"}`,
    `Preferred contact: ${contact || "Email"}`,
    "",
    "Project description:",
    description,
  ].join("\n");

  try {
    const delivery = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mubash Elite Website <website@mubashelite.com>",
        to: ["info@mubashelite.com"],
        cc: ["mubashelitespecialist@gmail.com"],
        reply_to: email,
        subject: `New Shopify project inquiry — ${name}`,
        text: message,
      }),
    });

    if (!delivery.ok) {
      return json({ error: "Your inquiry could not be delivered. Please email info@mubashelite.com directly." }, 502);
    }
    return json({ received: true, emailSent: true }, 201);
  } catch {
    return json({ error: "The inquiry service is temporarily unavailable. Please email info@mubashelite.com directly." }, 502);
  }
}
