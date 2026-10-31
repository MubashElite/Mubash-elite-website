import { router, json, error, db, secrets } from '@appdeploy/sdk';

type Inquiry = {
  name: string;
  email: string;
  website?: string;
  country?: string;
  category?: string;
  stage: string;
  area: string;
  description: string;
  budget?: string;
  contact?: string;
  createdAt: string;
  status: string;
};

const clean = (value: unknown, max = 300) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export const handler = router({
  'GET /api/health': [
    async () => json({ ok: true, service: 'Mubash Elite inquiry service' }),
  ],
  'POST /api/inquiries': [
    async ({ body }) => {
      const input = (body && typeof body === 'object' ? body : {}) as Record<
        string,
        unknown
      >;
      if (clean(input.websiteTrap, 200))
        return error('Unable to process this request.', 400);
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
      if (!name || !email || !stage || !area || !description)
        return error('Please complete all required fields.', 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return error('Please provide a valid business email.', 400);
      if (website && !/^https?:\/\//i.test(website))
        return error('Store URL must begin with https:// or http://.', 400);
      if (description.length < 15)
        return error(
          'Please provide a little more detail about your project.',
          400
        );

      const record: Inquiry = {
        name,
        email,
        website,
        country,
        category,
        stage,
        area,
        description,
        budget,
        contact,
        createdAt: new Date().toISOString(),
        status: 'received',
      };
      const [id] = await db.add('project_inquiries', [
        record as unknown as Record<string, unknown>,
      ]);
      if (!id)
        return error('Your inquiry could not be saved. Please try again.', 503);

      const configured = (await secrets.listSecretNames()).includes(
        'RESEND_API_KEY'
      );
      if (!configured)
        return json({ received: true, emailSent: false, inquiryId: id }, 202);
      try {
        const key = await secrets.readSecret('RESEND_API_KEY');
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Mubash Elite Website <website@mubashelite.com>',
            to: ['info@mubashelite.com'],
            cc: ['mubashelitespecialist@gmail.com'],
            reply_to: email,
            subject: `New Shopify project inquiry — ${name}`,
            text: [
              'A new project inquiry was submitted through mubashelite.com.',
              '',
              `Name: ${name}`,
              `Email: ${email}`,
              `Store: ${website || 'Not provided'}`,
              `Country: ${country || 'Not provided'}`,
              `Category: ${category || 'Not provided'}`,
              `Stage: ${stage}`,
              `Priority: ${area}`,
              `Budget: ${budget || 'Not provided'}`,
              `Preferred contact: ${contact || 'Email'}`,
              '',
              'Project description:',
              description,
              '',
              `Inquiry reference: ${id}`,
            ].join('\n'),
          }),
        });
        if (!response.ok) {
          console.error(
            'Inquiry email delivery failed with status',
            response.status
          );
          return json({ received: true, emailSent: false, inquiryId: id }, 202);
        }
        return json({ received: true, emailSent: true, inquiryId: id }, 201);
      } catch (err) {
        console.error('Inquiry email delivery failed', err);
        return json({ received: true, emailSent: false, inquiryId: id }, 202);
      }
    },
  ],
});
