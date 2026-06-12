import { useMemo, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'

import { EMPTY_ARRAY } from '../lib/constants'
import { supabase } from '../lib/supabase'

type OgretmenInput = {
  ad: string
  soyad: string
  eposta: string
}

type Ogretmen = {
  id: string
  ad: string | null
  soyad: string | null
  eposta: string | null
  created_at: string
}

type Sonuc = {
  eposta: string
  ad?: string
  soyad?: string
  gecici_sifre?: string
  durum: 'ok' | 'hata'
  mesaj?: string
}

type InvokeResponse = {
  sonuclar?: Sonuc[]
  error?: string
}

async function fetchOgretmenler() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, ad, soyad, eposta, created_at')
    .eq('rol', 'ogretmen')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as Ogretmen[]) ?? []
}

function indirExcel(rows: Record<string, string>[], dosyaAdi: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Liste')
  XLSX.writeFile(workbook, dosyaAdi)
}

export default function OgretmenEkle() {
  const queryClient = useQueryClient()
  const [ogretmenler, setOgretmenler] = useState<OgretmenInput[]>([])
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const [dosyaHatasi, setDosyaHatasi] = useState<string | null>(null)

  const {
    data: mevcutOgretmenlerData,
    isLoading: ogretmenlerLoading,
    error: ogretmenlerError,
  } = useQuery({
    queryKey: ['ogretmenler'],
    queryFn: fetchOgretmenler,
  })
  const mevcutOgretmenler = mevcutOgretmenlerData ?? EMPTY_ARRAY

  const invokeMutation = useMutation({
    mutationFn: async (payload: OgretmenInput[]) => {
      const { data, error } = await supabase.functions.invoke<InvokeResponse>('toplu-ogretmen-ekle', {
        body: { ogretmenler: payload },
      })

      if (error) {
        throw error
      }

      if (!data) {
        throw new Error('Fonksiyondan boş yanıt döndü.')
      }

      if (data.error) {
        throw new Error(data.error)
      }

      return data.sonuclar ?? []
    },
    onSuccess: async (data) => {
      setSonuclar(data)
      await queryClient.invalidateQueries({ queryKey: ['ogretmenler'] })
    },
  })

  const basariliSonuclar = useMemo(
    () => sonuclar.filter((item) => item.durum === 'ok' && item.gecici_sifre),
    [sonuclar]
  )

  const handleSablonIndir = () => {
    indirExcel([{ ad: '', soyad: '', eposta: '' }], 'ogretmen-sablon.xlsx')
  }

  const handleBasariliIndir = () => {
    if (basariliSonuclar.length === 0) return

    indirExcel(
      basariliSonuclar.map((item) => ({
        eposta: item.eposta,
        ad: item.ad ?? '',
        soyad: item.soyad ?? '',
        gecici_sifre: item.gecici_sifre ?? '',
      })),
      'ogretmen-hesaplari.xlsx'
    )
  }

  const handleDosyaSec = async (event: ChangeEvent<HTMLInputElement>) => {
    setDosyaHatasi(null)
    setSonuclar([])

    const file = event.target.files?.[0]
    if (!file) {
      setOgretmenler([])
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error('Excel sayfası bulunamadı.')
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const parsed = rows
        .map((row) => ({
          ad: String(row.ad ?? '').trim(),
          soyad: String(row.soyad ?? '').trim(),
          eposta: String(row.eposta ?? '').trim().toLowerCase(),
        }))
        .filter((row) => row.ad || row.soyad || row.eposta)

      if (parsed.length === 0) {
        throw new Error('Dosyada işlenecek kayıt bulunamadı.')
      }

      setOgretmenler(parsed)
    } catch (err) {
      setOgretmenler([])
      setDosyaHatasi(err instanceof Error ? err.message : 'Dosya okunamadı.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Excel ile Toplu Öğretmen Ekle</h1>
        <p className="mt-1 text-sm text-slate-600">
          Şablonu indir, doldur ve hesabı toplu şekilde oluştur.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSablonIndir}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Şablon İndir
          </button>

          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            .xlsx Seç
            <input type="file" accept=".xlsx" className="hidden" onChange={handleDosyaSec} />
          </label>

          <button
            type="button"
            onClick={() => invokeMutation.mutate(ogretmenler)}
            disabled={ogretmenler.length === 0 || invokeMutation.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {invokeMutation.isPending ? 'Hesaplar oluşturuluyor...' : 'Hesapları Oluştur'}
          </button>
        </div>

        {dosyaHatasi && <p className="mt-3 text-sm text-red-600">{dosyaHatasi}</p>}
        {invokeMutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            {invokeMutation.error instanceof Error
              ? invokeMutation.error.message
              : 'Toplu ekleme sırasında hata oluştu.'}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Önizleme</h2>
        {ogretmenler.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Henüz dosya seçilmedi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ad</th>
                  <th className="px-3 py-2 font-medium">Soyad</th>
                  <th className="px-3 py-2 font-medium">E-posta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ogretmenler.map((item, index) => (
                  <tr key={`${item.eposta}-${index}`}>
                    <td className="px-3 py-2 text-slate-800">{item.ad}</td>
                    <td className="px-3 py-2 text-slate-800">{item.soyad}</td>
                    <td className="px-3 py-2 text-slate-700">{item.eposta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Fonksiyon Sonuçları</h2>
          <button
            type="button"
            onClick={handleBasariliIndir}
            disabled={basariliSonuclar.length === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Şifreli Listeyi İndir (Excel)
          </button>
        </div>

        {sonuclar.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Henüz toplu oluşturma çalıştırılmadı.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">E-posta</th>
                  <th className="px-3 py-2 font-medium">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Geçici Şifre</th>
                  <th className="px-3 py-2 font-medium">Mesaj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sonuclar.map((item, index) => (
                  <tr key={`${item.eposta}-${item.durum}-${index}`}>
                    <td className="px-3 py-2 text-slate-700">{item.eposta}</td>
                    <td className="px-3 py-2 text-slate-800">{`${item.ad ?? ''} ${item.soyad ?? ''}`.trim() || '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          item.durum === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.durum}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-800">{item.gecici_sifre ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{item.mesaj ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mevcut Öğretmenler</h2>
        {ogretmenlerLoading && <p className="mt-3 text-sm text-slate-600">Öğretmenler yükleniyor...</p>}
        {ogretmenlerError && (
          <p className="mt-3 text-sm text-red-600">
            {ogretmenlerError instanceof Error ? ogretmenlerError.message : 'Öğretmen listesi alınamadı.'}
          </p>
        )}
        {!ogretmenlerLoading && !ogretmenlerError && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium">E-posta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mevcutOgretmenler.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-800">{`${item.ad ?? ''} ${item.soyad ?? ''}`.trim() || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{item.eposta ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
