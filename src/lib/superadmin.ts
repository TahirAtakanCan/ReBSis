import { supabase } from './supabase'

type SuperadminYanit<T> = {
  data?: T
  ok?: boolean
  error?: string
}

export async function superadminCagir<T = unknown>(
  islem: string,
  veri?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<SuperadminYanit<T>>('superadmin', {
    body: { islem, veri },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (data?.data !== undefined) {
    return data.data as T
  }

  return data as T
}

export const ABONELIK_DURUM_ETIKET: Record<string, string> = {
  deneme: 'Deneme',
  aktif: 'Aktif',
  suresi_doldu: 'Süresi Doldu',
  pasif: 'Pasif',
}
