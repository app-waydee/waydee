import { cn } from '@/lib/utils'
import type { TerritoryEffect } from '@/types/api'

/**
 * Mağazanın <b>haritadaki işaretçisi</b>: rengi ve tasarımı.
 *
 * <p>🔴 <b>21 Ağu 2026 — İŞARETÇİ ARTIK HALKALI PROFİL FOTOĞRAFI.</b> Kullanıcı
 * talimatı ve ekran görüntüsü: *"W logosu yerine kişinin profil fotoğrafı,
 * LIVE yazan yere kişinin ismi; birden fazla renk seçilebilsin, soft şekilde
 * yanıp sönsün; mağaza açınca bu tasarımı seçebilsin"*.
 *
 * <p>🔴 <b>21 Ağu (2. bölüm) — TASARIM SEÇENEKLERİ KALDIRILDI.</b> Kullanıcı:
 * *"tek renk nabız parıltı sakin bunları kaldır düzgün çalışmıyorlar"*.
 * Nabız/Parıltı/Sakin haritada birbirinden ayırt edilemiyordu; üç seçenek
 * seçim ekranını şişirip üç ayrı kod yolu üretiyordu. Geriye <b>tek ayar</b>
 * kaldı: <b>renk</b>. Tasarım herkeste aynı ve referans görseldeki tasarımdır.
 *
 * <p>⚠️ Eskiden kaldırılan alanlar ({@code fillOpacity}, {@code strokeWidth},
 * {@code effect}) taslakta <b>DURUYOR</b> ve varsayılanlarıyla gönderiliyor:
 * sunucu sözleşmesi ({@code TerritoryStyleRequest}) ve <b>mevcut kayıtlar</b>
 * onları taşıyor. İstemciden silmek, eski dairelerin kenar kalınlığını
 * sessizce sıfırlardı.
 */
export interface TerritoryStyleDraft {
  strokeColor: string
  fillColor: string
  fillOpacity: number
  strokeWidth: number
  /** Artık arayüzden seçilmez; her zaman `NONE` gider (bkz. dosya başı). */
  effect: TerritoryEffect
}

export const DEFAULT_STYLE: TerritoryStyleDraft = {
  strokeColor: '#2a85ff',
  fillColor: '#2a85ff',
  fillOpacity: 0.38,
  strokeWidth: 2.5,
  effect: 'NONE',
}

/**
 * Core 2.0 paletiyle uyumlu hazır renkler.
 *
 * <p>⚠️ Bu liste <b>yalnız seçim</b> içindir; haritadaki görseller artık
 * paletten değil <b>veriden</b> üretiliyor (`ensurePlateImages`). Sebep
 * ölçülmüştü: sunucunun renk seçmemiş kullanıcılara verdiği otomatik palet
 * (`OWNER_COLORS`) bu listeyle üç renkte ayrışıyor ve palete güvenen kod o
 * kullanıcılara yanlış renk gösteriyordu.
 */
const COLORS = [
  '#2a85ff', '#83bf6e', '#8e59ff', '#ff6a55',
  '#ff9c2b', '#00d1c1', '#ff4fa3', '#111315',
]

/**
 * Gradient halkanın ikinci rengi — <b>haritadaki `gradientPartner` ile aynı
 * formül</b>.
 *
 * <p>⚠️ Bilinçli bir tekrardır: harita tarafı bir tuval çizimi, burası CSS.
 * Ortak bir modüle almak, çizim mantığını arayüz bileşenine ya da bileşen
 * mantığını harita tuvaline bağlardı. ⚠️ Ton kayması (<b>+32°</b>) ve
 * parlaklık artışı ikisinde de <b>aynı</b> tutulmalı; ayrışırsa önizleme
 * haritadan farklı bir renk gösterir.
 */
function partner(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 0.08) return hex
  const sat = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360 + 32) % 360
  const nl = Math.min(l + 0.08, 0.72)
  const c = (1 - Math.abs(2 * nl - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = nl - c / 2
  const [rr, gg, bb] =
    h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
        : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c]
            : h < 300 ? [x, 0, c]
              : [c, 0, x]
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}

interface Props {
  value: TerritoryStyleDraft
  onChange: (next: TerritoryStyleDraft) => void
  /** Kompakt mod: mağaza kurma panelinde daha az yer kaplar. */
  compact?: boolean
  /** Önizlemedeki fotoğraf — kullanıcının kendi avatarı. */
  avatarUrl?: string | null
  /** Fotoğraf yoksa basılacak baş harf kaynağı. */
  name?: string
}

/** Mağaza işaretçisinin rengi ve tasarımı. */
export function TerritoryStylePicker({
  value,
  onChange,
  compact = false,
  avatarUrl = null,
  name = '',
}: Props) {
  const set = (patch: Partial<TerritoryStyleDraft>) => onChange({ ...value, ...patch })
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      {/*
        ---- ÖNİZLEME
        🔴 Önizleme artık bir daire değil, <b>haritadaki işaretçinin kendisi</b>:
        aynı halka, aynı beyaz kılıf, aynı fotoğraf, aynı ad levhası. Eskiden
        burada yalnız renkli bir halka vardı ve kullanıcı seçtiği şeyin haritada
        neye benzeyeceğini kuramıyordu.
        ⚠️ Nabız CSS ile: bu bir DOM önizlemesi, harita değil — burada CSS
        animasyonu tek bir öğede çalışır ve haritanın kare bütçesine dokunmaz.
      */}
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-subtle py-6',
          compact && 'py-5',
        )}
      >
        {/*
          ⚠️ Bu blok haritadaki `drawMarker`/`drawPlate` ile <b>birebir aynı</b>
          görünmek zorunda: beyaz iç daire, KOYU baş harf, GRADIENT halka,
          sağ-alta binen BÜYÜK HARF rozet. Ayrışırsa kullanıcı burada bir şey
          seçer, haritada başkasını görür — bu bir kez yaşandı.
        */}
        <span className="relative grid place-items-center">
          <span
            aria-hidden
            className="waydee-marker-glow absolute h-[4.4rem] w-[4.4rem] rounded-full"
            style={{ backgroundColor: value.strokeColor }}
          />
          {/* Gradient halka: dış katman gradient, iç katman beyaz kılıf. */}
          <span
            className="relative grid h-14 w-14 place-items-center rounded-full p-[4px]"
            style={{
              backgroundImage: `linear-gradient(45deg, ${partner(value.strokeColor)}, ${value.strokeColor})`,
            }}
          >
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-white p-[2.5px]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                /* ⚠️ KOYU harf, BEYAZ zemin — referanstaki siyah logonun yeri.
                   Beyaz harf + renkli zemin tam tersi bir görüntü veriyordu. */
                <span className="text-[19px] font-bold leading-none text-ink">{initial}</span>
              )}
            </span>
          </span>
          {/* Ad rozeti — referanstaki "LIVE" rozetinin yerindeki şey:
              dairenin SAĞ ALT köşesine biner, tam yuvarlak, beyaz kılıflı,
              BÜYÜK HARF ve harf arası açık. */}
          <span
            className="absolute -bottom-1.5 left-[52%] max-w-[7.5rem] truncate rounded-full px-2 py-[0.12rem] text-[10px] font-bold uppercase tracking-[0.06em] text-white ring-[3.5px] ring-white"
            style={{
              backgroundImage: `linear-gradient(45deg, ${partner(value.strokeColor)}, ${value.strokeColor})`,
            }}
          >
            {name.trim() || 'Mağazan'}
          </span>
        </span>
      </div>

      {/* ---- Renk */}
      <div>
        <p className={cn('mb-2 text-[13px] font-semibold text-muted', compact && 'mb-1.5')}>
          İşaretçi rengi
        </p>
        <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              /* ⚠️ `fillColor` da yazılır: daire dolgusu ile halka aynı rengi
                 paylaşır. Ayrı bırakılsaydı kullanıcı halkayı değiştirir,
                 yerdeki daire eski renkte kalırdı. */
              onClick={() => set({ strokeColor: color, fillColor: color })}
              className={cn(
                'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                compact && 'h-7 w-7',
                value.strokeColor.toLowerCase() === color ? 'border-ink' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
