import { useMemo, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'

import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type ParsedRow = {
  rowNo: number
  ad: string
  soyad: string
  sinif: string
  ogrenci_no: string
  veli_ad: string
  veli_telefon: string
}

type ValidationRow = ParsedRow & {
  durum: 'gecerli' | 'hata'
  sebep?: string
}

type ImportErrorRow = ParsedRow & {
  sebep: string
}

type ImportReport = {
  olusturulanSinifSayisi: number
  islenenOgrenciSayisi: number
  hataSayisi: number
  hataliSatirlar: ImportErrorRow[]
}

type Sinif = {
  id: string
  ad: string
}

type OgrenciPayload = {
  row: ParsedRow
  data: {
    kurum_id: string
    sinif_id: string | null
    ad: string
    soyad: string
    ogrenci_no: string | null
    veli_ad: string | null
    veli_telefon: string | null
    durum: 'aktif'
  }
}

const TEMPLATE_NOTE =
  'Not: ogrenci_no opsiyoneldir; tekrar yuklemede guncelleme icin kullanilmasi onerilir.'

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function normalizeSinifAd(name: string) {
  return name.trim().toLocaleLowerCase('tr')
}

function readCell(row: unknown[], index: number) {
  return String(row[index] ?? '').trim()
}

function indirTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [TEMPLATE_NOTE],
    ['ad', 'soyad', 'sinif', 'ogrenci_no', 'veli_ad', 'veli_telefon'],
  ])
  ws['!cols'] = [{ wch: 90 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ogrenciler')
  XLSX.writeFile(wb, 'ogrenci-sablon.xlsx')
}

function parseExcel(file: File): Promise<ParsedRow[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) throw new Error('Excel sayfasi bulunamadi.')

    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    if (rows.length === 0) return []

    const headerIndex = rows.findIndex((row) => {
      const firstSix = Array.isArray(row) ? row.slice(0, 6).map((v) => String(v).trim().toLowerCase()) : []
      return firstSix[0] === 'ad' && firstSix[1] === 'soyad'
    })
    if (headerIndex < 0) {
      throw new Error('Baslik satiri bulunamadi. Sablon dosyasini kullanin.')
    }

    const parsed: ParsedRow[] = []
    const bodyRows = rows.slice(headerIndex + 1)
    bodyRows.forEach((row, index) => {
      if (!Array.isArray(row)) return
      const ad = readCell(row, 0)
      const soyad = readCell(row, 1)
      const sinif = readCell(row, 2)
      const ogrenci_no = readCell(row, 3)
      const veli_ad = readCell(row, 4)
      const veli_telefon = readCell(row, 5)

      // Tamamen bos satirlari atla
      if (![ad, soyad, sinif, ogrenci_no, veli_ad, veli_telefon].some(Boolean)) return
      // Ozellikle ad+soyad tamamen bos olan satirlari da atla
      if (!ad && !soyad) return

      parsed.push({
        rowNo: headerIndex + 2 + index,
        ad,
        soyad,
        sinif,
        ogrenci_no,
        veli_ad,
        veli_telefon,
      })
    })

    return parsed
  })
}

function validateRows(rows: ParsedRow[]): ValidationRow[] {
  const noCounts = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.ogrenci_no) return
    noCounts.set(row.ogrenci_no, (noCounts.get(row.ogrenci_no) ?? 0) + 1)
  })

  return rows.map((row) => {
    if (!row.ad || !row.soyad) {
      return { ...row, durum: 'hata', sebep: 'Ad ve soyad zorunludur.' }
    }
    if (row.ogrenci_no && (noCounts.get(row.ogrenci_no) ?? 0) > 1) {
      return { ...row, durum: 'hata', sebep: 'Dosyada tekrar eden ogrenci_no var.' }
    }
    return { ...row, durum: 'gecerli' }
  })
}

async function sinifHaritasiHazirla(kurumId: string, sinifAdlari: string[]) {
  const adlar = Array.from(new Set(sinifAdlari.map((ad) => ad.trim()).filter(Boolean)))
  if (adlar.length === 0) return { map: new Map<string, string>(), olusturulan: 0 }

  const { data: mevcut, error: fetchError } = await supabase
    .from('siniflar')
    .select('id, ad')
    .eq('kurum_id', kurumId)

  if (fetchError) throw fetchError

  const map = new Map<string, string>()
  ;(mevcut as Sinif[]).forEach((s) => map.set(normalizeSinifAd(s.ad), s.id))

  const eksikAdlar = adlar.filter((ad) => !map.has(normalizeSinifAd(ad)))
  let olusturulan = 0

  if (eksikAdlar.length > 0) {
    const { error: insertError } = await supabase.from('siniflar').insert(
      eksikAdlar.map((ad) => ({
        kurum_id: kurumId,
        ad: ad.trim(),
      }))
    )

    // Unique cakismasi vb. durumlarda tekrar fetch ederek haritayi senkronla
    if (!insertError) {
      olusturulan = eksikAdlar.length
    }

    const { data: refetched, error: refetchError } = await supabase
      .from('siniflar')
      .select('id, ad')
      .eq('kurum_id', kurumId)
    if (refetchError) throw refetchError

    map.clear()
    ;(refetched as Sinif[]).forEach((s) => map.set(normalizeSinifAd(s.ad), s.id))
  }

  return { map, olusturulan }
}

export default function OgrenciIceAktar() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [dosyaHatasi, setDosyaHatasi] = useState<string | null>(null)
  const [rapor, setRapor] = useState<ImportReport | null>(null)

  const validationRows = useMemo(() => validateRows(parsedRows), [parsedRows])
  const gecerliRows = useMemo(() => validationRows.filter((r) => r.durum === 'gecerli'), [validationRows])
  const hataliRows = useMemo(() => validationRows.filter((r) => r.durum === 'hata'), [validationRows])
  const previewRows = useMemo(() => validationRows.slice(0, 20), [validationRows])

  const iceAktarMutation = useMutation({
    mutationFn: async (rows: ValidationRow[]): Promise<ImportReport> => {
      if (!profile?.kurum_id) {
        throw new Error('Kurum bilgisi bulunamadi. Once onboarding tamamlanmali.')
      }

      const validRows = rows.filter((row) => row.durum === 'gecerli')
      const hataListesi: ImportErrorRow[] = rows
        .filter((row): row is ValidationRow & { sebep: string } => row.durum === 'hata' && !!row.sebep)
        .map((row) => ({ ...row, sebep: row.sebep }))

      if (validRows.length === 0) {
        return {
          olusturulanSinifSayisi: 0,
          islenenOgrenciSayisi: 0,
          hataSayisi: hataListesi.length,
          hataliSatirlar: hataListesi,
        }
      }

      const sinifAdlari = validRows.map((row) => row.sinif).filter(Boolean)
      const { map: sinifMap, olusturulan } = await sinifHaritasiHazirla(profile.kurum_id, sinifAdlari)

      const payloadRows: OgrenciPayload[] = validRows.map((row) => {
        const sinifId = row.sinif ? sinifMap.get(normalizeSinifAd(row.sinif)) ?? null : null
        return {
          row,
          data: {
            kurum_id: profile.kurum_id as string,
            sinif_id: sinifId,
            ad: row.ad,
            soyad: row.soyad,
            ogrenci_no: row.ogrenci_no || null,
            veli_ad: row.veli_ad || null,
            veli_telefon: row.veli_telefon || null,
            durum: 'aktif',
          },
        }
      })

      const withNo = payloadRows.filter((item) => item.data.ogrenci_no)
      const withoutNo = payloadRows.filter((item) => !item.data.ogrenci_no)
      let islenen = 0

      const handleChunkFailure = async (
        items: OgrenciPayload[],
        mode: 'upsert' | 'insert'
      ) => {
        for (const item of items) {
          const builder =
            mode === 'upsert'
              ? supabase.from('ogrenciler').upsert(item.data, { onConflict: 'kurum_id,ogrenci_no' })
              : supabase.from('ogrenciler').insert(item.data)
          const { error } = await builder
          if (error) {
            hataListesi.push({ ...item.row, sebep: error.message })
          } else {
            islenen += 1
          }
        }
      }

      for (const chunk of chunkArray(withNo, 500)) {
        const { error } = await supabase
          .from('ogrenciler')
          .upsert(
            chunk.map((item) => item.data),
            { onConflict: 'kurum_id,ogrenci_no' }
          )
        if (error) {
          await handleChunkFailure(chunk, 'upsert')
        } else {
          islenen += chunk.length
        }
      }

      for (const chunk of chunkArray(withoutNo, 500)) {
        const { error } = await supabase.from('ogrenciler').insert(chunk.map((item) => item.data))
        if (error) {
          await handleChunkFailure(chunk, 'insert')
        } else {
          islenen += chunk.length
        }
      }

      return {
        olusturulanSinifSayisi: olusturulan,
        islenenOgrenciSayisi: islenen,
        hataSayisi: hataListesi.length,
        hataliSatirlar: hataListesi,
      }
    },
    onSuccess: async (data) => {
      setRapor(data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ogrenciler'] }),
        queryClient.invalidateQueries({ queryKey: ['siniflar'] }),
      ])
    },
  })

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setDosyaHatasi(null)
    setRapor(null)
    const file = event.target.files?.[0]
    if (!file) {
      setParsedRows([])
      return
    }

    try {
      const parsed = await parseExcel(file)
      setParsedRows(parsed)
    } catch (error) {
      setParsedRows([])
      setDosyaHatasi(error instanceof Error ? error.message : 'Dosya okunamadi.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Excel ile Toplu Ogrenci Ekle</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ogrenciler auth kullanmaz; kayitlar dogrudan RLS korumali `ogrenciler` tablosuna yazilir.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={indirTemplate}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sablon Indir
          </button>

          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            .xlsx Sec
            <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
          </label>

          <button
            type="button"
            onClick={() => iceAktarMutation.mutate(validationRows)}
            disabled={iceAktarMutation.isPending || validationRows.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {iceAktarMutation.isPending ? 'Ice aktariliyor...' : 'Ice Aktar'}
          </button>
        </div>

        {dosyaHatasi && <p className="mt-3 text-sm text-red-600">{dosyaHatasi}</p>}
        {iceAktarMutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            {iceAktarMutation.error instanceof Error
              ? iceAktarMutation.error.message
              : 'Ice aktarma sirasinda bir hata olustu.'}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Onizleme</h2>
        <p className="mt-1 text-sm text-slate-600">
          Toplam {validationRows.length} satir, gecerli {gecerliRows.length}, hatali {hataliRows.length}
        </p>

        {validationRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Henuz dosya secilmedi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Satir</th>
                  <th className="px-3 py-2 font-medium">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium">Sinif</th>
                  <th className="px-3 py-2 font-medium">Ogrenci No</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Sebep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {previewRows.map((row) => (
                  <tr key={`preview-${row.rowNo}-${row.ogrenci_no}-${row.ad}`}>
                    <td className="px-3 py-2 text-slate-700">{row.rowNo}</td>
                    <td className="px-3 py-2 text-slate-800">{row.ad} {row.soyad}</td>
                    <td className="px-3 py-2 text-slate-700">{row.sinif || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.ogrenci_no || '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          row.durum === 'gecerli' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.durum}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.sebep ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {validationRows.length > 20 && (
          <p className="mt-2 text-xs text-slate-500">Onizlemede sadece ilk 20 satir gosteriliyor.</p>
        )}
      </div>

      {rapor && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Sonuc Raporu</h2>
          <p className="mt-1 text-sm text-slate-700">
            {rapor.olusturulanSinifSayisi} sinif olusturuldu, {rapor.islenenOgrenciSayisi} ogrenci eklendi/guncellendi, {rapor.hataSayisi} hata.
          </p>

          {rapor.hataliSatirlar.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Satir</th>
                    <th className="px-3 py-2 font-medium">Ad Soyad</th>
                    <th className="px-3 py-2 font-medium">Ogrenci No</th>
                    <th className="px-3 py-2 font-medium">Sebep</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rapor.hataliSatirlar.map((row, index) => (
                    <tr key={`err-${row.rowNo}-${index}`}>
                      <td className="px-3 py-2 text-slate-700">{row.rowNo}</td>
                      <td className="px-3 py-2 text-slate-800">{row.ad} {row.soyad}</td>
                      <td className="px-3 py-2 text-slate-700">{row.ogrenci_no || '-'}</td>
                      <td className="px-3 py-2 text-red-700">{row.sebep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
