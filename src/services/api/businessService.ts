/**
 * Edición de los datos del negocio (Configuración). Separado de authService:
 * ese archivo es solo inicio/cierre de sesión y registro, este es el CRUD
 * del propio negocio ya autenticado.
 */
import { supabase } from './supabaseClient'
import { mapBusiness } from './mappers'
import type { Business, BusinessUpdateInput } from '@/types/domain'
import type { BusinessRow } from '@/types/database'

export async function updateBusiness(businessId: string, input: BusinessUpdateInput): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses_cafexis')
    .update({
      name: input.name,
      type: input.type,
      country: input.country,
      primary_color: input.primaryColor,
    })
    .eq('id', businessId)
    .select()
    .single<BusinessRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo actualizar el negocio.')
  return mapBusiness(data)
}

/** Formatos y tamaño que acepta el bucket business-logos (0013_auditoria_seguridad_cafexis.sql). */
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_FORMAT_ERROR = 'El logo debe ser PNG, JPG o WebP de máximo 2 MB.'

export function isValidLogoFile(file: File): boolean {
  return LOGO_MIME_TYPES.includes(file.type) && file.size <= LOGO_MAX_BYTES
}

/**
 * Sube el logo al bucket público "business-logos" (ver migración
 * 0005_fase1_datos_base_cafexis.sql) bajo "<businessId>/logo.<ext>" y
 * guarda la URL pública resultante en businesses_cafexis.logo_url.
 */
export async function uploadBusinessLogo(businessId: string, file: File): Promise<Business> {
  if (!isValidLogoFile(file)) throw new Error(LOGO_FORMAT_ERROR)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${businessId}/logo.${ext}`

  const { error: uploadError } = await supabase.storage.from('business-logos').upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (uploadError) throw new Error(uploadError.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from('business-logos').getPublicUrl(path)

  // Evita que el navegador muestre el logo anterior cacheado bajo la misma URL.
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`

  const { data, error } = await supabase
    .from('businesses_cafexis')
    .update({ logo_url: cacheBustedUrl })
    .eq('id', businessId)
    .select()
    .single<BusinessRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar el logo del negocio.')
  return mapBusiness(data)
}
