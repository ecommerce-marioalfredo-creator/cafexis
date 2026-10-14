import { supabase } from './supabaseClient'
import { browserTimeZone } from './reportPeriods'
import type {
  NewSupportCaseInput,
  PlatformBusinessDetail,
  PlatformBusinessOverview,
  SupportCaseDetail,
  SupportCaseMessage,
  SupportCasePriority,
  SupportCaseStatus,
  SupportCaseSummary,
  SupportStaffMember,
} from '@/types/domain'

/**
 * Casos de soporte y consola de plataforma (Fase 7). Todo pasa por RPC de
 * 0011_fase7_plataforma_soporte_cafexis.sql: las tablas no tienen
 * políticas de escritura, y el rol soporte no puede leer businesses_cafexis
 * de otros negocios, así que las funciones devuelven los nombres ya
 * resueltos. Las reglas (quién ve qué caso, notas internas, quién cambia el
 * estado) se aplican en la base de datos, no aquí.
 */

const optional = <T,>(v: T | null | undefined) => (v === null ? undefined : v)

interface CaseRowRaw {
  id: string
  code: string
  business_id: string
  business_name: string
  subject: string
  category: SupportCaseSummary['category']
  priority: SupportCasePriority
  status: SupportCaseStatus
  opened_by_name: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  messages: number
  first_response_at: string | null
  last_activity_at: string
  created_at: string
}

const mapCase = (r: CaseRowRaw): SupportCaseSummary => ({
  id: r.id,
  code: r.code,
  businessId: r.business_id,
  businessName: r.business_name,
  subject: r.subject,
  category: r.category,
  priority: r.priority,
  status: r.status,
  openedByName: optional(r.opened_by_name),
  assignedTo: optional(r.assigned_to),
  assignedToName: optional(r.assigned_to_name),
  messages: Number(r.messages),
  firstResponseAt: optional(r.first_response_at),
  lastActivityAt: r.last_activity_at,
  createdAt: r.created_at,
})

export async function listSupportCases(
  filters: { businessId?: string; statuses?: SupportCaseStatus[]; assignedToMe?: boolean } = {},
): Promise<SupportCaseSummary[]> {
  const { data, error } = await supabase.rpc('list_support_cases_cafexis', {
    p_business_id: filters.businessId ?? null,
    p_statuses: filters.statuses && filters.statuses.length > 0 ? filters.statuses : null,
    p_assigned_to_me: filters.assignedToMe ?? false,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CaseRowRaw[]).map(mapCase)
}

interface CaseDetailRaw extends Omit<CaseRowRaw, 'messages'> {
  description: string
  resolved_at: string | null
  closed_at: string | null
  messages: Array<{
    id: string
    kind: SupportCaseMessage['kind']
    body: string
    author_name: string | null
    author_is_staff: boolean
    created_at: string
  }>
}

export async function getSupportCase(caseId: string): Promise<SupportCaseDetail> {
  const { data, error } = await supabase.rpc('get_support_case_cafexis', { p_case_id: caseId })
  if (error) throw new Error(error.message)
  const r = data as CaseDetailRaw
  return {
    ...mapCase({ ...r, messages: 0 }),
    description: r.description,
    resolvedAt: optional(r.resolved_at),
    closedAt: optional(r.closed_at),
    messages: r.messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      authorName: optional(m.author_name),
      authorIsStaff: m.author_is_staff,
      createdAt: m.created_at,
    })),
  }
}

export async function openSupportCase(input: NewSupportCaseInput): Promise<string> {
  const { data, error } = await supabase.rpc('open_support_case_cafexis', {
    p_subject: input.subject,
    p_description: input.description,
    p_category: input.category,
    p_priority: input.priority,
    p_business_id: input.businessId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function addSupportCaseMessage(caseId: string, body: string, internal = false): Promise<void> {
  const { error } = await supabase.rpc('add_support_case_message_cafexis', {
    p_case_id: caseId,
    p_body: body,
    p_internal: internal,
  })
  if (error) throw new Error(error.message)
}

export async function updateSupportCase(
  caseId: string,
  changes: { status?: SupportCaseStatus; priority?: SupportCasePriority; assignedTo?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc('update_support_case_cafexis', {
    p_case_id: caseId,
    p_status: changes.status ?? null,
    p_priority: changes.priority ?? null,
    p_assigned_to: changes.assignedTo ?? null,
    p_unassign: changes.assignedTo === null,
  })
  if (error) throw new Error(error.message)
}

export async function listSupportStaff(): Promise<SupportStaffMember[]> {
  const { data, error } = await supabase.rpc('list_support_staff_cafexis')
  if (error) throw new Error(error.message)
  return (data ?? []) as SupportStaffMember[]
}

interface OverviewRaw {
  id: string
  name: string
  type: PlatformBusinessOverview['type']
  slug: string | null
  primary_color: string
  logo_url: string | null
  created_at: string
  active_users: number
  last_sign_in_at: string | null
  last_order_at: string | null
  orders_today: number
  sales_today: number | string
  orders_7d: number
  sales_7d: number | string
  low_stock: number
  out_of_stock: number
  open_proposals: number
  open_cases: number
  urgent_cases: number
}

export async function getPlatformOverview(): Promise<PlatformBusinessOverview[]> {
  const { data, error } = await supabase.rpc('platform_business_overview_cafexis', { p_tz: browserTimeZone() })
  if (error) throw new Error(error.message)
  return ((data ?? []) as OverviewRaw[]).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    slug: optional(r.slug),
    primaryColor: r.primary_color,
    logoUrl: optional(r.logo_url),
    createdAt: r.created_at,
    activeUsers: Number(r.active_users),
    lastSignInAt: optional(r.last_sign_in_at),
    lastOrderAt: optional(r.last_order_at),
    ordersToday: Number(r.orders_today),
    salesToday: Number(r.sales_today),
    orders7d: Number(r.orders_7d),
    sales7d: Number(r.sales_7d),
    lowStock: Number(r.low_stock),
    outOfStock: Number(r.out_of_stock),
    openProposals: Number(r.open_proposals),
    openCases: Number(r.open_cases),
    urgentCases: Number(r.urgent_cases),
  }))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getPlatformBusinessDetail(businessId: string): Promise<PlatformBusinessDetail> {
  const { data, error } = await supabase.rpc('platform_business_detail_cafexis', {
    p_business_id: businessId,
    p_tz: browserTimeZone(),
  })
  if (error) throw new Error(error.message)
  const d = data as any
  return {
    business: {
      id: d.business.id,
      name: d.business.name,
      type: d.business.type,
      country: d.business.country,
      slug: optional(d.business.slug),
      primaryColor: d.business.primary_color,
      logoUrl: optional(d.business.logo_url),
      createdAt: d.business.created_at,
    },
    users: d.users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      lastSignInAt: optional(u.last_sign_in_at),
    })),
    pendingInvitations: Number(d.pending_invitations),
    inventoryAlerts: d.inventory_alerts.map((i: any) => ({
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      threshold: Number(i.threshold),
      status: i.status,
    })),
    recentOrders: d.recent_orders.map((o: any) => ({
      code: o.code,
      createdAt: o.created_at,
      total: Number(o.total),
      status: o.status,
      paymentMethod: o.payment_method,
      items: Number(o.items),
    })),
    openPurchaseOrders: d.open_purchase_orders.map((p: any) => ({
      code: p.code,
      status: p.status,
      origin: p.origin,
      createdAt: p.created_at,
    })),
    sales14d: (d.sales_14d ?? []).map((s: any) => ({ day: String(s.day).slice(0, 10), revenue: Number(s.revenue), orders: Number(s.orders) })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
