export type DevamsizlikDurum = 'yok' | 'gec' | 'izinli'

/** UI-only; "geldi" means no row in devamsizlik table */
export type YoklamaDurum = DevamsizlikDurum | 'geldi'

export type Devamsizlik = {
  id: string
  kurum_id: string
  ogrenci_id: string
  tarih: string
  durum: DevamsizlikDurum
  aciklama: string | null
  olusturan_id: string
  created_at: string
}
