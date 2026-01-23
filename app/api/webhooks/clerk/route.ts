import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('Missing CLERK_WEBHOOK_SECRET');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return Response.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    const body = await req.text();
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle user.created event
    if (evt.type === 'user.created') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const primaryEmail = email_addresses?.find(
        e => e.id === evt.data.primary_email_address_id
      )?.email_address;

      // Use upsert to handle potential duplicates (e.g., webhook retries)
      await prisma.user.upsert({
        where: { clerkId },
        update: {
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
        create: {
          clerkId,
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
      });

      console.log(`User created/updated: ${clerkId}`);
    }

    // Handle user.updated event
    // Use upsert for robustness: handles cases where update event arrives
    // before create event, or if webhook was enabled after users existed
    if (evt.type === 'user.updated') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const primaryEmail = email_addresses?.find(
        e => e.id === evt.data.primary_email_address_id
      )?.email_address;

      await prisma.user.upsert({
        where: { clerkId },
        update: {
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
        create: {
          clerkId,
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
      });

      console.log(`User updated: ${clerkId}`);
    }

    // Handle user.deleted event
    // Use deleteMany for idempotency: safe for webhook retries or if user
    // was never synced to local database (no-op if user doesn't exist)
    if (evt.type === 'user.deleted') {
      const { id: clerkId } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      // Delete user and cascade to related records
      // Note: Prisma cascade rules in schema will handle related data cleanup
      const result = await prisma.user.deleteMany({
        where: { clerkId },
      });

      if (result.count > 0) {
        console.log(`User deleted: ${clerkId}`);
      } else {
        console.log(`User not found (already deleted or never synced): ${clerkId}`);
      }
    }

    return Response.json({ success: true, type: evt.type });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
