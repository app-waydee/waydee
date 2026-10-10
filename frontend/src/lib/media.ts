import { api } from './api'
import type { MediaResponse } from '@/types/api'

/**
 * <b>Kendi medya adresimizi bir {@link File}'a çevirir</b> (V45).
 *
 * <p>Yapay zekâ stüdyosunda üretilen bir görseli gönderiye ya da hikâyeye
 * taşımak için gerekir: iki akış da <b>dosya</b> bekliyor (kırpma tuvali,
 * yükleme). Görseli yeniden yüklemek gerekir çünkü kırpma sonrası bayt zaten
 * yeni bir görseldir.
 *
 * <p>🔴 <b>{@code stream=1} ŞART.</b> Normal medya adresi depoya (S3) <b>302</b>
 * ile gider ve S3 CORS başlığı döndürmez; {@code fetch} ve {@code canvas} ise
 * CORS ister. Bayrak olmadan istek sessizce başarısız olur ya da tuval
 * "kirlenir" ({@code toDataURL} SecurityError atar). Bayrak yetkiyi
 * zayıflatmaz — imza {@code id + e} üzerinden hesaplanıyor, {@code stream}
 * yalnız teslim yolunu seçiyor (bkz. vault, 85. tur).
 */
export async function fileFromMediaUrl(url: string, name = 'ai.jpg'): Promise<File> {
  const sameOrigin = url.includes('?') ? `${url}&stream=1` : `${url}?stream=1`
  const res = await fetch(sameOrigin)
  if (!res.ok) throw new Error('media fetch failed')
  const blob = await res.blob()
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

/** Sunucunun görsel tavanı (`MediaService.MAX_SIZE_BYTES`) ile aynı olmalı. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Küçültme sonrası uzun kenar. Model zaten 1280px kullanıyor; 2048 fazlasıyla yeter. */
const MAX_EDGE = 2048

/** Bu eşiğin üstündeki dosya, ölçüsü küçük olsa bile yeniden kodlanır. */
const RECODE_OVER_BYTES = 3 * 1024 * 1024

/**
 * Uzantıdan görsel tanıma — <b>MIME tipi boş geldiğinde</b> devreye girer.
 *
 * <p>🔴 Ölçüldü (16 Ağu 2026): bazı dosyalar tarayıcıya {@code type: ""} ile
 * geliyor (bilinmeyen uzantı eşlemesi, bazı uygulamalardan sürükleme, `.jfif`).
 * Yalnız {@code type.startsWith('image/')} bakan bir eleme bunları <b>sessizce
 * atıyordu</b> ve kullanıcı "jpg yüklenmiyor" diyordu.
 */
const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif)$/i

export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name)
}

/** Sunucunun kabul ettiği tipler (`MediaService.ALLOWED_TYPES` ile aynı). */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Uzantı → MIME eşlemesi; tip eksikken buradan türetilir. */
const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/**
 * Dosyanın MIME tipi eksik ya da sunucunun kabul etmediği bir şeyse
 * <b>uzantıdan türetip yeniden etiketler</b>.
 *
 * <p>⚠️ Bayt kopyalanmaz — {@code new File([file], …)} özgün Blob'u sarar.
 */
function withKnownType(file: File): File {
  if (ACCEPTED_TYPES.includes(file.type)) return file
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = EXT_TO_TYPE[ext]
  if (!type) return file // bilinmiyor → küçültme adımı yeniden kodlayacak
  return new File([file], file.name, { type })
}

/**
 * <b>Yüklemeye hazırlar: gerekiyorsa küçültüp JPEG'e çevirir.</b>
 *
 * <h3>🔴 Neden gerekli — ölçüldü</h3>
 * <p>Sunucunun görsel tavanı <b>10 MB</b>. Sıradan bir telefon fotoğrafı bunu
 * rahatlıkla aşıyor: testte 4000×3000 bir JPEG <b>11,6 MB</b> çıktı ve sunucu
 * <b>413</b> döndürdü. Kullanıcı için bu "jpg yüklenmiyor" demekti.
 *
 * <p>Tavanı yükseltmek yanlış çözüm olurdu: baytlar depoya, oradan da modele
 * gidiyor ve model zaten <b>1280px</b> kullanıyor — yani fazlası hem para hem
 * bant genişliği. Doğrusu <b>istemcide küçültmek</b>.
 *
 * <p>⚠️ Küçültme <b>koşulludur</b>: küçük ve zaten uygun bir dosya olduğu gibi
 * gönderilir. Her dosyayı yeniden kodlamak, PNG'nin keskin kenarlarını
 * gereksiz yere JPEG'e çevirirdi.
 *
 * <p>⚠️ Şeffaflık <b>beyaza</b> düşer — ürün fotoğrafı için doğru varsayım ve
 * JPEG'in alfa kanalı yok (aksi halde siyah kare çıkıyor, aynı tuzak
 * backend'de de yaşandı).
 *
 * @throws Error tarayıcı görseli çözemezse (ör. HEIC'i Chrome açamaz)
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  /*
   * 🔴 ÖNCE MIME TİPİNİ DÜZELT. Sunucu `Content-Type`a bakıyor ve tipi boş
   * gelen bir dosyayı `FormData` <b>`application/octet-stream`</b> olarak
   * gönderiyor → <b>415 "Yalnızca JPEG, PNG, WebP ve GIF yüklenebilir"</b>
   * (ölçüldü). Yani dosya görsel olmasına rağmen reddediliyordu.
   *
   * ⚠️ Uzantıdan türetmek "tipe körü körüne güvenmek" değil: sunucu ayrıca
   * <b>sihirli bayt</b> kontrolü yapıyor, yani yanlış etiketlenmiş bir dosya
   * orada yine yakalanır. Buradaki iş yalnız doğru etiketi taşımak.
   */
  const normalized = withKnownType(file)
  /* Tip hâlâ kabul edilmiyorsa (uzantı da tanınmadı) dosya, boyutu ne olursa
     olsun yeniden kodlanır — aksi halde küçük ama etiketsiz bir dosya
     sunucudan 415 ile geri dönerdi. */
  const typeOk = ACCEPTED_TYPES.includes(normalized.type)
  const needsWork = !typeOk || normalized.size > RECODE_OVER_BYTES || normalized.size > MAX_UPLOAD_BYTES
  if (!needsWork) return normalized
  file = normalized

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    // Çözülemeyen biçim (çoğunlukla HEIC). Sunucuya göndermek anlamsız —
    // orada da reddedilir ve kullanıcı ham bir 415 görür.
    throw new Error('decode')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  /* Kalite basamaklı düşürülür: 0.9 yetmezse 0.8, sonra 0.7. Tek bir düşük
     kalitede sabitlemek, küçük bir fotoğrafı gereksiz yere bozardı. */
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
    }
  }
  // Buraya düşmek için 2048px'lik bir JPEG'in 10 MB'ı aşması gerekir; pratikte
  // olmaz. Yine de özgün dosyayı döndürüp kararı sunucuya bırakıyoruz.
  return file
}

export async function uploadImage(file: File): Promise<MediaResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<MediaResponse>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  })
  return data
}

/**
 * <b>Data URL → File</b>, {@code fetch} KULLANMADAN.
 *
 * <h3>🔴 17 Ağu 2026 — ÜRETİMİ KIRAN HATA</h3>
 * Kırpılan görsel {@code canvas.toDataURL()} ile bir {@code data:} URL'ine
 * çevriliyor, sonra {@code await fetch(dataUrl)} ile Blob'a döndürülüyordu.
 *
 * <p><b>Sorun:</b> {@code fetch}, {@code data:} adreslerinde de
 * <b>{@code connect-src}</b> yönergesine tabidir. CSP zorlayıcı moda
 * alındığında politikada {@code img-src data:} vardı ama
 * {@code connect-src data:} <b>yoktu</b> → istek tarayıcı tarafından
 * engellendi, düz bir {@code TypeError} atıldı ve kullanıcı yalnızca
 * "Gönderi oluşturulamadı" gördü. <b>Sunucuya hiç istek gitmedi</b>, bu
 * yüzden loglarda da hiçbir iz yoktu.
 *
 * <p>CSP'ye {@code data: blob:} eklendi <b>ama asıl çözüm bu değil</b>:
 * kendi verimizi kendimize ağ isteğiyle sormak zaten gereksizdi. Base64'ü
 * doğrudan çözmek hem daha hızlı hem de <b>hiçbir politikaya bağlı değil</b>.
 *
 * @throws Error girdi bir data URL değilse
 */
export function fileFromDataUrl(dataUrl: string, name = 'post.jpg'): File {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0) {
    throw new Error('data URL bekleniyordu')
  }
  const header = dataUrl.slice(5, comma)
  const type = header.split(';')[0] || 'image/jpeg'
  const body = dataUrl.slice(comma + 1)
  // ⚠️ `atob` yalnız base64 için; `data:` URL'i düz metin de olabilir.
  const bytes = header.includes(';base64')
    ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body))
  return new File([bytes], name, { type })
}
