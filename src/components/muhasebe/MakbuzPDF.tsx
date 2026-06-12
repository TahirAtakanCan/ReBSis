import { makbuzSiraNoFormat, ODEME_YONTEMI_ETIKET, paraFormatla, tarihFormatla } from '../../lib/muhasebe'

export type MakbuzPDFProps = {
  makbuz: { sira_no: number; olusturma_tarihi: string }
  tahsilat: {
    tutar: number
    odeme_yontemi: string
    odeme_tarihi: string
    aciklama?: string | null
  }
  taksit: { taksit_no: number; tutar: number; vade_tarihi: string }
  ogrenci: { ad: string; soyad: string }
  kurum: { ad: string }
}

type ReactPdfModule = typeof import('@react-pdf/renderer')
type MakbuzStyles = ReturnType<ReactPdfModule['StyleSheet']['create']>

let reactPdfPromise: Promise<ReactPdfModule> | null = null
let stylesCache: MakbuzStyles | null = null

async function loadReactPdf(): Promise<ReactPdfModule> {
  if (!reactPdfPromise) {
    reactPdfPromise = import('@react-pdf/renderer').then((mod) => {
      mod.Font.register({
        family: 'Roboto',
        src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      })
      return mod
    })
  }
  return reactPdfPromise
}

function getStyles(StyleSheet: ReactPdfModule['StyleSheet']): MakbuzStyles {
  if (!stylesCache) {
    stylesCache = StyleSheet.create({
      page: {
        fontFamily: 'Roboto',
        fontSize: 11,
        padding: 40,
        backgroundColor: '#ffffff',
        color: '#111111',
      },
      headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#cccccc',
        paddingBottom: 12,
      },
      title: {
        fontSize: 22,
        fontWeight: 'bold',
      },
      siraNo: {
        fontSize: 12,
        color: '#444444',
      },
      section: {
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
      },
      label: {
        fontSize: 9,
        color: '#666666',
        marginBottom: 4,
        textTransform: 'uppercase',
      },
      value: {
        fontSize: 12,
      },
      tutarBox: {
        marginTop: 8,
        marginBottom: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#cccccc',
        alignItems: 'center',
      },
      tutar: {
        fontSize: 24,
        fontWeight: 'bold',
      },
      footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        fontSize: 9,
        color: '#888888',
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eeeeee',
        paddingTop: 12,
      },
    })
  }
  return stylesCache
}

function createMakbuzBelgesi(
  { Document, Page, View, Text }: Pick<ReactPdfModule, 'Document' | 'Page' | 'View' | 'Text'>,
  styles: MakbuzStyles,
) {
  return function MakbuzBelgesi({ makbuz, tahsilat, taksit, ogrenci, kurum }: MakbuzPDFProps) {
    return (
      <Document>
        <Page size="A5" style={styles.page}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>MAKBUZ</Text>
            <Text style={styles.siraNo}>{makbuzSiraNoFormat(makbuz.sira_no)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Kurum</Text>
            <Text style={styles.value}>{kurum.ad}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Öğrenci</Text>
            <Text style={styles.value}>
              {ogrenci.ad} {ogrenci.soyad}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Ödeme Tarihi</Text>
            <Text style={styles.value}>{tarihFormatla(tahsilat.odeme_tarihi)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Taksit</Text>
            <Text style={styles.value}>
              #{taksit.taksit_no} — Vade: {tarihFormatla(taksit.vade_tarihi)}
            </Text>
          </View>

          <View style={styles.tutarBox}>
            <Text style={styles.label}>Tahsil Edilen Tutar</Text>
            <Text style={styles.tutar}>{paraFormatla(tahsilat.tutar)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Ödeme Yöntemi</Text>
            <Text style={styles.value}>
              {ODEME_YONTEMI_ETIKET[tahsilat.odeme_yontemi] ?? tahsilat.odeme_yontemi}
            </Text>
          </View>

          {tahsilat.aciklama && (
            <View style={styles.section}>
              <Text style={styles.label}>Açıklama</Text>
              <Text style={styles.value}>{tahsilat.aciklama}</Text>
            </View>
          )}

          <Text style={styles.footer}>Bu makbuz bilgisayar ortamında oluşturulmuştur.</Text>
        </Page>
      </Document>
    )
  }
}

export async function indirMakbuzPdf(props: MakbuzPDFProps) {
  const { pdf, Document, Page, View, Text, StyleSheet } = await loadReactPdf()
  const styles = getStyles(StyleSheet)
  const MakbuzBelgesi = createMakbuzBelgesi({ Document, Page, View, Text }, styles)
  const blob = await pdf(<MakbuzBelgesi {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `makbuz-${props.makbuz.sira_no}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
