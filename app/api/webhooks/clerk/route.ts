import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/monitoring/logger';

// Health check endpoint for monitoring
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      logger.error('Clerk webhook secret not configured', new Error('Missing CLERK_WEBHOOK_SECRET'), {
        route: '/api/webhooks/clerk',
      });
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      logger.warn('Clerk webhook missing svix headers', { svix_id, svix_timestamp, hasSignature: !!svix_signature });
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
      logger.error('Clerk webhook signature verification failed', err instanceof Error ? err : new Error(String(err)), {
        route: '/api/webhooks/clerk',
        svix_id,
      });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle user.created event
    if (evt.type === 'user.created') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        logger.error('Clerk webhook missing clerkId in payload', new Error('Missing clerkId'), {
          eventType: evt.type,
        });
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

      logger.info('Clerk webhook: user created/updated', { clerkId, email: primaryEmail });
    }

    // Handle user.updated event
    // Use upsert for robustness: handles cases where update event arrives
    // before create event, or if webhook was enabled after users existed
    if (evt.type === 'user.updated') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        logger.error('Clerk webhook missing clerkId in payload', new Error('Missing clerkId'), {
          eventType: evt.type,
        });
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

      logger.info('Clerk webhook: user updated', { clerkId, email: primaryEmail });
    }

    // Handle user.deleted event
    // Use deleteMany for idempotency: safe for webhook retries or if user
    // was never synced to local database (no-op if user doesn't exist)
    if (evt.type === 'user.deleted') {
      const { id: clerkId } = evt.data;

      if (!clerkId) {
        logger.error('Clerk webhook missing clerkId in payload', new Error('Missing clerkId'), {
          eventType: evt.type,
        });
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      // Delete user and cascade to related records
      // Note: Prisma cascade rules in schema will handle related data cleanup
      const result = await prisma.user.deleteMany({
        where: { clerkId },
      });

      if (result.count > 0) {
        logger.info('Clerk webhook: user deleted', { clerkId });
      } else {
        logger.info('Clerk webhook: user not found (already deleted or never synced)', { clerkId });
      }
    }

    const duration = Date.now() - startTime;
    logger.performance('/api/webhooks/clerk', duration, { eventType: evt.type });

    return Response.json({ success: true, type: evt.type });
  } catch (error) {
    logger.error('Clerk webhook handler error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/clerk',
    });
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
