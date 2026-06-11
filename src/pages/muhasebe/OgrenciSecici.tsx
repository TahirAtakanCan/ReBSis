import { useMemo, useState } from 'react'

type Ogrenci = {
  id: string
  ad: string
  soyad: string
}

type OgrenciSeciciProps = {
  ogrenciler: Ogrenci[]
  value: string
  onChange: (id: string) => void
  error?: string
  disabled?: boolean
}

export default function OgrenciSecici({ ogrenciler, value, onChange, error, disabled }: OgrenciSeciciProps) {
  const [arama, setArama] = useState('')
  const [acik, setAcik] = useState(false)

  const secili = ogrenciler.find((o) => o.id === value)

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    if (!q) return ogrenciler
    return ogrenciler.filter((o) => `${o.ad} ${o.soyad}`.toLocaleLowerCase('tr').includes(q))
  }, [arama, ogrenciler])

  const sec = (ogrenci: Ogrenci) => {
    onChange(ogrenci.id)
    setArama('')
    setAcik(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={acik ? arama : secili ? `${secili.ad} ${secili.soyad}` : ''}
        onChange={(e) => {
          setArama(e.target.value)
          setAcik(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => setAcik(true)}
        onBlur={() => setTimeout(() => setAcik(false), 150)}
        placeholder="Öğrenci ara..."
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:opacity-60"
      />

      {acik && filtrelenmis.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtrelenmis.map((ogrenci) => (
            <li key={ogrenci.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sec(ogrenci)}
                className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
              >
                {ogrenci.ad} {ogrenci.soyad}
              </button>
            </li>
          ))}
        </ul>
      )}

      {acik && arama && filtrelenmis.length === 0 && (
        <p className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          Sonuç bulunamadı.
        </p>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
