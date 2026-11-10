/**
 * Guías de preparación (videos y PDF por producto), ver
 * 0018_guias_preparacion_cafexis.sql.
 *
 * Los archivos viven en el bucket PRIVADO "product-guides": nunca se guarda
 * una URL pública, solo la ruta, y se firma una URL temporal cada vez que
 * alguien abre el material (getProductGuideUrl). La base de datos decide quién
 * puede firmarla: el personal del negocio siempre; el cliente final solo si el
 * material está marcado como disponible para él.
 */
import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapProductGuide, mapPublicProductGuide } from './mappers'
import type { ProductGuide, ProductGuideInput, ProductGuideKind, PublicProductGuide } from '@/types/domain'
import type { ProductGuideRow, PublicProductGuideRow } from '@/types/database'

const BUCKET = 'product-guides'

/** Mismos límites que el bucket (0018): 50 MB; PDF, MP4 o WebM. */
export const GUIDE_FILE_MAX_BYTES = 50 * 1024 * 1024
export const GUIDE_FILE_TYPES: Record<ProductGuideKind, string[]> = {
  pdf: ['application/pdf'],
  video: ['video/mp4', 'video/webm'],
}
const EXTENSION_TYPES: Record<string, string> = { pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm' }

/** Lo que dura la URL firmada de un archivo: suficiente para ver un video completo. */
const SIGNED_URL_SECONDS = 2 * 60 * 60

/** Tipo MIME del archivo; algunos navegadores lo dejan vacío y se deduce de la extensión. */
export function guideFileType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[ext] ?? ''
}

export async function listProductGuides(): Promise<ProductGuide[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('product_guides_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })
    .returns<ProductGuideRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapProductGuide)
}

/** Sube el archivo bajo "<businessId>/<uuid>.<ext>" y devuelve su ruta en el bucket. */
async function uploadGuideFile(businessId: string, file: File): Promise<string> {
  const contentType = guideFileType(file)
  const ext = Object.entries(EXTENSION_TYPES).find(([, type]) => type === contentType)?.[0] ?? 'bin'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType })
  if (error) throw new Error(error.message)
  return path
}

async function removeGuideFile(path: string | undefined): Promise<void> {
  if (!path) return
  // Si falla, el archivo queda huérfano en el bucket pero ninguna guía lo
  // referencia; no vale la pena interrumpir al usuario por eso.
  await supabase.storage.from(BUCKET).remove([path])
}

function rowFields(input: ProductGuideInput) {
  return {
    product_id: input.productId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    kind: input.kind,
    visible_to_customers: input.visibleToCustomers,
  }
}

/** Crea un material: con archivo (se sube al bucket) o con enlace externo. */
export async function createProductGuide(input: ProductGuideInput, file?: File): Promise<ProductGuide> {
  const businessId = await getActiveBusinessId()
  const externalUrl = input.externalUrl?.trim()
  if (!file && !externalUrl) throw new Error('Sube un archivo o pega un enlace.')

  const storagePath = file ? await uploadGuideFile(businessId, file) : undefined

  const { data, error } = await supabase
    .from('product_guides_cafexis')
    .insert({
      business_id: businessId,
      ...rowFields(input),
      storage_path: storagePath ?? null,
      external_url: storagePath ? null : externalUrl,
    })
    .select()
    .single<ProductGuideRow>()

  if (error || !data) {
    await removeGuideFile(storagePath)
    throw new Error(error?.message ?? 'No se pudo guardar el material.')
  }
  return mapProductGuide(data)
}

/**
 * Edita un material. Si llega un archivo, reemplaza al anterior; si llega un
 * enlace, reemplaza el archivo (que se borra del bucket); si no llega ninguno,
 * conserva el que tenía.
 */
export async function updateProductGuide(guide: ProductGuide, input: ProductGuideInput, file?: File): Promise<ProductGuide> {
  const externalUrl = input.externalUrl?.trim()
  let source: { storage_path: string | null; external_url: string | null } | undefined
  let newPath: string | undefined

  if (file) {
    newPath = await uploadGuideFile(await getActiveBusinessId(), file)
    source = { storage_path: newPath, external_url: null }
  } else if (externalUrl) {
    source = { storage_path: null, external_url: externalUrl }
  } else if (!guide.storagePath && !guide.externalUrl) {
    throw new Error('Sube un archivo o pega un enlace.')
  }

  const { data, error } = await supabase
    .from('product_guides_cafexis')
    .update({ ...rowFields(input), ...source })
    .eq('id', guide.id)
    .select()
    .single<ProductGuideRow>()

  if (error || !data) {
    await removeGuideFile(newPath)
    throw new Error(error?.message ?? 'No se pudo guardar el material.')
  }

  // El archivo anterior ya no lo usa nadie.
  if (source && guide.storagePath && guide.storagePath !== data.storage_path) await removeGuideFile(guide.storagePath)
  return mapProductGuide(data)
}

export async function setProductGuideVisibility(id: string, visibleToCustomers: boolean): Promise<void> {
  const { error } = await supabase
    .from('product_guides_cafexis')
    .update({ visible_to_customers: visibleToCustomers })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteProductGuide(guide: ProductGuide): Promise<void> {
  const { error } = await supabase.from('product_guides_cafexis').delete().eq('id', guide.id)
  if (error) throw new Error(error.message)
  await removeGuideFile(guide.storagePath)
}

/**
 * URL para ver el material: el enlace externo tal cual, o una URL firmada
 * temporal del archivo. Falla si quien la pide no tiene permiso (por ejemplo,
 * un cliente con un material que ya no está disponible para él).
 */
export async function getProductGuideUrl(guide: Pick<PublicProductGuide, 'storagePath' | 'externalUrl'>): Promise<string> {
  if (guide.externalUrl) return guide.externalUrl
  if (!guide.storagePath) throw new Error('Este material no tiene archivo ni enlace.')

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(guide.storagePath, SIGNED_URL_SECONDS)
  if (error || !data) throw new Error('Este material ya no está disponible.')
  return data.signedUrl
}

/** Materiales disponibles para el cliente en el catálogo público (no requiere sesión). */
export async function listPublicProductGuides(businessId: string): Promise<PublicProductGuide[]> {
  const { data, error } = await supabase.rpc('get_public_product_guides_cafexis', { p_business_id: businessId })

  if (error) throw new Error(error.message)
  return ((data ?? []) as PublicProductGuideRow[]).map(mapPublicProductGuide)
}
