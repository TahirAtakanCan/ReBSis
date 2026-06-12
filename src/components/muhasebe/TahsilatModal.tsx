import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '../../lib/auth'
import { EMPTY_ARRAY } from '../../lib/constants'
import {
  ODEME_YONTEMI_ETIKET,
  paraFormatla,
  tarihFormatla,
  taksitBorcu,
} from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { Makbuz, OdemeYontemi, Sozlesme, Tahsilat, Taksit } from '../../lib/types'
import { indirMakbuzPdf } from './MakbuzPDF'

function bugununTarihi() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchTahsilatlar(taksitId: string) {
  const { data, error } = await supabase.from('tahsilatlar').select('*').eq('taksit_id', taksitId)

  if (error) throw error
  return (data as Tahsilat[]) ?? []
}

function tahsilatSchema(kalanTutar: number) {
  return z.object({
    tutar: z
      .number()
      .positive('Tutar 0\'dan büyük olmalıdır.')
      .max(kalanTutar, `Tutar kalan borçtan (${paraFormatla(kalanTutar)}) fazla olamaz.`),
    odeme_yontemi: z.enum(['nakit', 'havale', 'kart']),
    odeme_tarihi: z.string().min(1, 'Ödeme tarihi zorunludur.'),
    aciklama: z.string().optional(),
  })
}

type TahsilatFormValues = z.infer<ReturnType<typeof tahsilatSchema>>

type TahsilatModalProps = {
  taksit: Taksit
  sozlesme: Sozlesme
  onClose: () => void
  onSuccess: () => void
}

export default function TahsilatModal({ taksit, sozlesme, onClose, onSuccess }: TahsilatModalProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const { data: tahsilatlarData, isLoading } = useQuery({
    queryKey: ['tahsilatlar', taksit.id],
    queryFn: () => fetchTahsilatlar(taksit.id),
  })
  const tahsilatlar = tahsilatlarData ?? EMPTY_ARRAY

  const borc = taksitBorcu(taksit)
  const toplamOdenen = useMemo(
    () => tahsilatlar.reduce((acc, t) => acc + Number(t.tutar), 0),
    [tahsilatlar]
  )
  const kalanTutar = Math.round((borc - toplamOdenen) * 100) / 100

  const schema = useMemo(() => tahsilatSchema(kalanTutar), [kalanTutar])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TahsilatFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tutar: kalanTutar > 0 ? kalanTutar : 0,
      odeme_yontemi: 'nakit',
      odeme_tarihi: bugununTarihi(),
      aciklama: '',
    },
  })

  const formAnahtariRef = useRef('')

  useEffect(() => {
    if (isLoading || kalanTutar <= 0) return

    const formAnahtari = `${taksit.id}:${kalanTutar}:${tahsilatlar.length}`
    if (formAnahtariRef.current === formAnahtari) return
    formAnahtariRef.current = formAnahtari

    reset({
      tutar: kalanTutar,
      odeme_yontemi: 'nakit',
      odeme_tarihi: bugununTarihi(),
      aciklama: '',
    })
  }, [isLoading, kalanTutar, reset, taksit.id, tahsilatlar.length])

  const kaydetMutation = useMutation({
    mutationFn: async (values: TahsilatFormValues) => {
      if (!profile?.kurum_id || !profile.id) {
        throw new Error('Kurum bilgisi bulunamadı.')
      }

      const { data: tahsilat, error: tahsilatError } = await supabase
        .from('tahsilatlar')
        .insert({
          kurum_id: profile.kurum_id,
          taksit_id: taksit.id,
          tutar: values.tutar,
          odeme_yontemi: values.odeme_yontemi,
          odeme_tarihi: values.odeme_tarihi,
          aciklama: values.aciklama?.trim() ? values.aciklama.trim() : null,
          alan_id: profile.id,
        })
        .select('*')
        .single()

      if (tahsilatError) throw tahsilatError

      const { data: sonMakbuz, error: siraError } = await supabase
        .from('makbuzlar')
        .select('sira_no')
        .eq('kurum_id', profile.kurum_id)
        .order('sira_no', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (siraError) {
        await supabase.from('tahsilatlar').delete().eq('id', tahsilat.id)
        throw siraError
      }

      const siraNo = (sonMakbuz?.sira_no ?? 0) + 1

      const { data: makbuz, error: makbuzError } = await supabase
        .from('makbuzlar')
        .insert({
          kurum_id: profile.kurum_id,
          tahsilat_id: tahsilat.id,
          sira_no: siraNo,
        })
        .select('*')
        .single()

      if (makbuzError) {
        await supabase.from('tahsilatlar').delete().eq('id', tahsilat.id)
        throw makbuzError
      }

      const yeniToplam = Math.round((toplamOdenen + values.tutar) * 100) / 100
      const yeniDurum = yeniToplam >= borc ? 'odendi' : 'kismi'

      const { error: taksitError } = await supabase
        .from('taksitler')
        .update({ durum: yeniDurum })
        .eq('id', taksit.id)

      if (taksitError) {
        await supabase.from('makbuzlar').delete().eq('id', makbuz.id)
        await supabase.from('tahsilatlar').delete().eq('id', tahsilat.id)
        throw taksitError
      }

      return { tahsilat: tahsilat as Tahsilat, makbuz: makbuz as Makbuz }
    },
    onSuccess: async ({ tahsilat, makbuz }) => {
      await queryClient.invalidateQueries({ queryKey: ['taksitler', sozlesme.id] })
      await queryClient.invalidateQueries({ queryKey: ['tahsilatlar', taksit.id] })
      await queryClient.invalidateQueries({ queryKey: ['tahsilatlar'] })

      const ogrenci = sozlesme.ogrenciler
      if (ogrenci) {
        await indirMakbuzPdf({
          makbuz: {
            sira_no: makbuz.sira_no,
            olusturma_tarihi: makbuz.olusturma_tarihi,
          },
          tahsilat: {
            tutar: tahsilat.tutar,
            odeme_yontemi: tahsilat.odeme_yontemi,
            odeme_tarihi: tahsilat.odeme_tarihi,
            aciklama: tahsilat.aciklama,
          },
          taksit: {
            taksit_no: taksit.taksit_no,
            tutar: taksit.tutar,
            vade_tarihi: taksit.vade_tarihi,
          },
          ogrenci,
          kurum: { ad: profile?.kurum_adi ?? profile?.kurum_id ?? 'Kurum' },
        })
      }

      onSuccess()
      onClose()
    },
  })

  const ogrenciAdi = sozlesme.ogrenciler
    ? `${sozlesme.ogrenciler.ad} ${sozlesme.ogrenciler.soyad}`
    : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tahsilat Al</h2>
            <p className="mt-1 text-sm text-slate-600">
              {ogrenciAdi} — Taksit #{taksit.taksit_no}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={kaydetMutation.isPending}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <div>
            <p className="text-xs text-slate-500">Borç</p>
            <p className="text-sm font-semibold text-slate-900">{paraFormatla(borc)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ödenen</p>
            <p className="text-sm font-semibold text-emerald-700">{paraFormatla(toplamOdenen)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Kalan</p>
            <p className="text-sm font-semibold text-slate-900">{paraFormatla(kalanTutar)}</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {!isLoading && tahsilatlar.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Önceki Tahsilatlar</h3>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {tahsilatlar.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-slate-600">{tarihFormatla(t.odeme_tarihi)}</span>
                  <span className="font-medium text-slate-900">{paraFormatla(t.tutar)}</span>
                  <span className="text-slate-500">
                    {ODEME_YONTEMI_ETIKET[t.odeme_yontemi] ?? t.odeme_yontemi}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLoading && kalanTutar > 0 && (
          <form className="space-y-4" onSubmit={handleSubmit((v) => kaydetMutation.mutate(v))}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tutar">
                Tutar (₺)
              </label>
              <input
                id="tutar"
                type="number"
                step="0.01"
                min="0.01"
                max={kalanTutar}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                {...register('tutar', { valueAsNumber: true })}
              />
              {errors.tutar && <p className="mt-1 text-xs text-red-600">{errors.tutar.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="odeme_yontemi">
                Ödeme Yöntemi
              </label>
              <select
                id="odeme_yontemi"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                {...register('odeme_yontemi')}
              >
                {(Object.entries(ODEME_YONTEMI_ETIKET) as [OdemeYontemi, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="odeme_tarihi">
                Ödeme Tarihi
              </label>
              <input
                id="odeme_tarihi"
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                {...register('odeme_tarihi')}
              />
              {errors.odeme_tarihi && (
                <p className="mt-1 text-xs text-red-600">{errors.odeme_tarihi.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="aciklama">
                Açıklama
              </label>
              <input
                id="aciklama"
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                {...register('aciklama')}
              />
            </div>

            {kaydetMutation.error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {kaydetMutation.error instanceof Error
                  ? kaydetMutation.error.message
                  : 'Tahsilat kaydedilemedi.'}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={kaydetMutation.isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={kaydetMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Tahsilat Kaydet'}
              </button>
            </div>
          </form>
        )}

        {!isLoading && kalanTutar <= 0 && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Bu taksit tamamen ödenmiş.
          </p>
        )}
      </div>
    </div>
  )
}
