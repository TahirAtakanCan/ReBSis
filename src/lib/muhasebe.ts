import type { TaksitTipi } from './types'

export type TaksitTaslak = {
  taksit_no: number
  tutar: number
  vade_tarihi: string
}

export function paraFormatla(tutar: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tutar)
}

export function tarihFormatla(tarih: string) {
  return new Date(`${tarih}T00:00:00`).toLocaleDateString('tr-TR')
}

export function ayEkle(tarih: string, ay: number) {
  const [yil, ayStr, gun] = tarih.split('-').map(Number)
  const date = new Date(yil, ayStr - 1 + ay, gun)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function hesaplaNetTutar(brutTutar: number, indirimTutari: number) {
  return Math.round((brutTutar - indirimTutari) * 100) / 100
}

export function hesaplaTaksitler(
  taksitTipi: TaksitTipi,
  netTutar: number,
  taksitSayisi: number,
  ilkVadeTarihi: string
): TaksitTaslak[] {
  if (taksitTipi === 'serbest') {
    return Array.from({ length: taksitSayisi }, (_, i) => ({
      taksit_no: i + 1,
      tutar: 0,
      vade_tarihi: ayEkle(ilkVadeTarihi, i),
    }))
  }

  const baseTutar = Math.floor((netTutar / taksitSayisi) * 100) / 100
  const sonTaksit = Math.round((netTutar - baseTutar * (taksitSayisi - 1)) * 100) / 100

  return Array.from({ length: taksitSayisi }, (_, i) => ({
    taksit_no: i + 1,
    tutar: i === taksitSayisi - 1 ? sonTaksit : baseTutar,
    vade_tarihi: ayEkle(ilkVadeTarihi, i),
  }))
}

export const TAKSIT_DURUM_ETIKET: Record<string, string> = {
  bekliyor: 'Bekliyor',
  kismi: 'Kısmi',
  odendi: 'Ödendi',
  gecikti: 'Gecikti',
}

export const TAKSIT_DURUM_RENK: Record<string, string> = {
  bekliyor: 'bg-slate-100 text-slate-700',
  kismi: 'bg-amber-100 text-amber-800',
  odendi: 'bg-emerald-100 text-emerald-800',
  gecikti: 'bg-red-100 text-red-800',
}

export const ODEME_YONTEMI_ETIKET: Record<string, string> = {
  nakit: 'Nakit',
  havale: 'Banka Havalesi',
  kart: 'Kart',
}

export function makbuzSiraNoFormat(siraNo: number) {
  return `MKB-${String(siraNo).padStart(4, '0')}`
}

export function taksitBorcu(taksit: { tutar: number; gecikme_ucreti: number }) {
  return Math.round((taksit.tutar + taksit.gecikme_ucreti) * 100) / 100
}

export const GIDER_KATEGORI_ETIKET: Record<string, string> = {
  kira: 'Kira',
  maas: 'Maaş',
  fatura: 'Fatura',
  malzeme: 'Malzeme',
  diger: 'Diğer',
}

export const AY_ADLARI = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

export function bugununTarihi() {
  return new Date().toISOString().slice(0, 10)
}

export function donemAraligi(yil: number, ay: number) {
  const ayStr = String(ay).padStart(2, '0')
  const sonGun = new Date(yil, ay, 0).getDate()
  return {
    baslangic: `${yil}-${ayStr}-01`,
    bitis: `${yil}-${ayStr}-${String(sonGun).padStart(2, '0')}`,
  }
}
