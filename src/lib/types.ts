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

export type TaksitTipi = 'sabit' | 'serbest'

export type TaksitDurum = 'bekliyor' | 'kismi' | 'odendi' | 'gecikti'

export type Sozlesme = {
  id: string
  kurum_id: string
  ogrenci_id: string
  donem: string
  brut_tutar: number
  indirim_tutari: number
  net_tutar: number
  taksit_tipi: TaksitTipi
  taksit_sayisi: number
  notlar: string | null
  olusturan_id: string
  created_at: string
  ogrenciler?: { ad: string; soyad: string } | null
}

export type Taksit = {
  id: string
  kurum_id: string
  sozlesme_id: string
  taksit_no: number
  tutar: number
  vade_tarihi: string
  gecikme_ucreti: number
  durum: TaksitDurum
  created_at: string
}

export type OdemeYontemi = 'nakit' | 'havale' | 'kart'

export type Tahsilat = {
  id: string
  kurum_id: string
  taksit_id: string
  tutar: number
  odeme_yontemi: OdemeYontemi
  odeme_tarihi: string
  aciklama: string | null
  alan_id: string
  created_at: string
}

export type Makbuz = {
  id: string
  kurum_id: string
  tahsilat_id: string
  sira_no: number
  olusturma_tarihi: string
}

export type GiderKategori = 'kira' | 'maas' | 'fatura' | 'malzeme' | 'diger'

export type Gider = {
  id: string
  kurum_id: string
  kategori: GiderKategori
  tutar: number
  tarih: string
  aciklama: string | null
  odeme_yontemi: OdemeYontemi
  olusturan_id: string
  created_at: string
  profiles?: { ad: string; soyad: string } | null
}
