import { builder } from '../schema/builder';
import { NotFoundError, withErrorMapping } from '../errors';
import { Client, Project, Invoice } from '../types';
import { ClientRef, InvoiceRef } from '../schema/types';

/**
 * ClientPortalProject type - Project data with aggregated totals
 */
const ClientPortalProjectRef = builder.objectRef<
  Project & { totalHours: number | null; totalAmountCents: number | null }
>('ClientPortalProject');

ClientPortalProjectRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    status: t.exposeString('status'),
    startDate: t.expose('start_date', { type: 'DateTime', nullable: true }),
    dueDate: t.expose('due_date', { type: 'DateTime', nullable: true }),
    budgetType: t.exposeString('budget_type', { nullable: true }),
    budgetHours: t.exposeInt('budget_hours', { nullable: true }),
    budgetAmountCents: t.exposeInt('budget_amount_cents', { nullable: true }),
    currency: t.field({
      type: 'String',
      resolve: async (parent, _args, ctx) => {
        // Get client currency
        const client = await ctx.db.query('SELECT currency FROM clients WHERE id = $1', [parent.client_id]);
        return client.rows[0]?.currency || 'USD';
      },
    }),
    totalHours: t.exposeFloat('totalHours', { nullable: true }),
    totalAmountCents: t.exposeInt('totalAmountCents', { nullable: true }),
  }),
});

/**
 * ClientPortalInvoice type - Invoice data with client currency
 */
const ClientPortalInvoiceRef = builder.objectRef<Invoice & { currency: string }>('ClientPortalInvoice');

ClientPortalInvoiceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    invoiceNumber: t.exposeString('invoice_number'),
    status: t.exposeString('status'),
    issuedDate: t.expose('issued_date', { type: 'DateTime' }),
    dueDate: t.expose('due_date', { type: 'DateTime' }),
    subtotalCents: t.exposeInt('subtotal_cents'),
    taxAmountCents: t.exposeInt('tax_amount_cents'),
    totalCents: t.exposeInt('total_cents'),
    currency: t.exposeString('currency'),
  }),
});

/**
 * ClientPortalData type - Public data for client portal access
 */
const ClientPortalDataRef = builder.objectRef<{
  client: Client;
  projects: (Project & { totalHours: number | null; totalAmountCents: number | null })[];
  invoices: (Invoice & { currency: string })[];
}>('ClientPortalData');

ClientPortalDataRef.implement({
  fields: (t) => ({
    client: t.field({
      type: ClientRef,
      resolve: (parent) => parent.client,
    }),
    projects: t.field({
      type: [ClientPortalProjectRef],
      resolve: (parent) => parent.projects,
    }),
    invoices: t.field({
      type: [ClientPortalInvoiceRef],
      resolve: (parent) => parent.invoices,
    }),
  }),
});

/**
 * Public Client Portal Query
 */
builder.queryFields((t) => ({
  /**
   * Access client portal data by phone code (last digits of phone number)
   * This is a public endpoint that doesn't require authentication
   */
  clientPortalAccess: t.field({
    type: ClientPortalDataRef,
    args: {
      phoneCode: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, ctx) => {
      const { phoneCode } = args;

      // Validate phone code (must be at least 4 digits)
      if (phoneCode.length < 4 || !/^\d+$/.test(phoneCode)) {
        throw new NotFoundError('Invalid phone code');
      }

      // Find client by last digits of phone number
      const clientResult = await ctx.db.query<Client>(
        `
        SELECT *
        FROM clients
        WHERE phone IS NOT NULL
          AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), $1) = $2
          AND archived_at IS NULL
        LIMIT 1
        `,
        [phoneCode.length.toString(), phoneCode]
      );

      if (clientResult.rows.length === 0) {
        throw new NotFoundError('Client not found with this phone code');
      }

      const client = clientResult.rows[0];

      // Get all active projects for this client with totals
      const projectsResult = await ctx.db.query<
        Project & { totalHours: number | null; totalAmountCents: number | null }
      >(
        `
        SELECT 
          p.*,
          COALESCE(SUM(te.duration_seconds) / 3600.0, 0) as "totalHours",
          COALESCE(ROUND(SUM(
            CASE 
              WHEN te.hourly_rate_cents IS NOT NULL THEN 
                (te.duration_seconds / 3600.0) * te.hourly_rate_cents
              WHEN pt.hourly_rate_cents IS NOT NULL THEN 
                (te.duration_seconds / 3600.0) * pt.hourly_rate_cents
              WHEN p.default_hourly_rate_cents IS NOT NULL THEN 
                (te.duration_seconds / 3600.0) * p.default_hourly_rate_cents
              WHEN c.default_hourly_rate_cents IS NOT NULL THEN 
                (te.duration_seconds / 3600.0) * c.default_hourly_rate_cents
              ELSE 0
            END
          )), 0)::INTEGER as "totalAmountCents"
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        LEFT JOIN time_entries te ON te.project_id = p.id
        LEFT JOIN project_tasks pt ON pt.id = te.task_id
        WHERE p.client_id = $1
          AND p.archived_at IS NULL
        GROUP BY p.id
        ORDER BY p.created_at DESC
        `,
        [client.id]
      );

      // Get all invoices for this client with currency
      const invoicesResult = await ctx.db.query<Invoice & { currency: string }>(
        `
        SELECT i.*, c.currency
        FROM invoices i
        JOIN clients c ON c.id = i.client_id
        WHERE i.client_id = $1
        ORDER BY i.issued_date DESC, i.created_at DESC
        `,
        [client.id]
      );

      return {
        client,
        projects: projectsResult.rows,
        invoices: invoicesResult.rows,
      };
    },
  }),
}));
