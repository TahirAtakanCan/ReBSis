import { supabase } from './supabase'
import type { BildirimDurum } from './types'

type BildirimEkstra = {
  ilgili_tip?: string
  ilgili_id?: string
}

type FonksiyonYanit = {
  ok?: boolean
  mod?: string
  error?: string
}

function durumBelirle(data: FonksiyonYanit | null, hata: Error | null): BildirimDurum {
  if (hata || data?.error) return 'hata'
  if (data?.mod === 'test') return 'test'
  if (data?.ok) return 'gonderildi'
  return 'hata'
}

export type BildirimSonuc = {
  ok: boolean
  durum: BildirimDurum
  error?: string
}

export async function smsSend(
  kurumId: string,
  telefon: string,
  mesaj: string,
  ekstra?: BildirimEkstra
): Promise<BildirimSonuc> {
  const { data, error } = await supabase.functions.invoke<FonksiyonYanit>('sms-gonder', {
    body: { telefon, mesaj },
  })

  const durum = durumBelirle(data, error)
  const hataMesaji = error?.message ?? data?.error

  const { error: kayitHata } = await supabase.from('bildirimler').insert({
    kurum_id: kurumId,
    tip: 'sms',
    alici_telefon: telefon,
    mesaj,
    durum,
    ilgili_tip: ekstra?.ilgili_tip ?? null,
    ilgili_id: ekstra?.ilgili_id ?? null,
  })

  if (kayitHata) {
    return { ok: false, durum: 'hata', error: kayitHata.message }
  }

  return {
    ok: durum !== 'hata',
    durum,
    error: durum === 'hata' ? hataMesaji : undefined,
  }
}

export async function epostaSend(
  kurumId: string,
  aliciEposta: string,
  konu: string,
  icerikHtml: string,
  ekstra?: BildirimEkstra
): Promise<BildirimSonuc> {
  const { data, error } = await supabase.functions.invoke<FonksiyonYanit>('eposta-gonder', {
    body: { alici_eposta: aliciEposta, konu, icerik_html: icerikHtml },
  })

  const durum = durumBelirle(data, error)
  const hataMesaji = error?.message ?? data?.error

  const { error: kayitHata } = await supabase.from('bildirimler').insert({
    kurum_id: kurumId,
    tip: 'eposta',
    alici_eposta: aliciEposta,
    konu,
    mesaj: icerikHtml,
    durum,
    ilgili_tip: ekstra?.ilgili_tip ?? null,
    ilgili_id: ekstra?.ilgili_id ?? null,
  })

  if (kayitHata) {
    return { ok: false, durum: 'hata', error: kayitHata.message }
  }

  return {
    ok: durum !== 'hata',
    durum,
    error: durum === 'hata' ? hataMesaji : undefined,
  }
}

export const BILDIRIM_DURUM_ETIKET: Record<string, string> = {
  gonderildi: 'Gönderildi',
  test: 'Test',
  hata: 'Hata',
}

export const BILDIRIM_DURUM_RENK: Record<string, string> = {
  gonderildi: 'bg-emerald-100 text-emerald-800',
  test: 'bg-amber-100 text-amber-800',
  hata: 'bg-red-100 text-red-800',
}
