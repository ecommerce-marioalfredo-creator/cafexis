import { supabase, getActiveBusinessId } from './supabaseClient'
import { invokeEdgeFunction } from './edgeFunctions'
import { mapAppUser, mapUserInvitation } from './mappers'
import type { AppUser, InvitableRole, UserInvitation, UserRole } from '@/types/domain'
import type { AppUserRow, UserInvitationRow } from '@/types/database'

export async function listUsers(businessId: string): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .returns<AppUserRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapAppUser)
}

export async function listInvitations(businessId: string): Promise<UserInvitation[]> {
  const { data, error } = await supabase
    .from('user_invitations_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })
    .returns<UserInvitationRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapUserInvitation)
}

/**
 * Invita a un usuario interno nuevo vía la Edge Function invite-user (ver
 * supabase/functions/invite-user/index.ts). No usa supabase.auth.signUp:
 * eso autenticaría como el usuario invitado y cerraría la sesión de quien
 * invita. La Edge Function usa la service_role key (solo en el servidor)
 * para enviar la invitación sin tocar la sesión activa en el navegador.
 *
 * Se envía el negocio activo: para el supervisor técnico puede ser el que
 * eligió en el selector (la Edge Function rechaza cualquier otro caso).
 */
export async function inviteUser(input: { email: string; name: string; role: InvitableRole }): Promise<void> {
  const businessId = await getActiveBusinessId()
  await invokeEdgeFunction<{ success?: boolean }>('invite-user', { ...input, businessId })
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('app_users_cafexis').update({ role }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('app_users_cafexis').update({ active }).eq('id', userId)
  if (error) throw new Error(error.message)
}
