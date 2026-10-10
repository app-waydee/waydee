import { api } from './api'

/**
 * <b>Yapay zekâ stüdyosu istemcisi</b> (V45).
 *
 * <p>🔴 <b>Maliyet burada HESAPLANMAZ, SORULUR</b> ({@link quoteFashion}).
 * Formülü buraya kopyalamak kolaydı ama iki kopya er geç birbirinden sapar ve
 * ekranda yazan rakam ile hesaptan düşen rakam farklı olurdu — kredi
 * ekonomisinde güveni en hızlı bitiren hata budur.
 */

/** Ayar açılır listelerinin kod listeleri — etiketler sözlükten gelir. */
export interface AiOptions {
  catalogue: Record<string, string[]>
  /**
   * Sahne araclarinin (editoryal + poz) kod listeleri: `creativity`, `aspectRatio`.
   *
   * AYRI bir alan olmasi bilinclidir: manken katalogunun icine konsaydi o
   * ekranin "Karistir" dugmesi en-boy oranini da rastgele secerdi -- oran bir
   * kimlik ozelligi degil, cikti bicimidir.
   */
  scene: Record<string, string[]>
  maxProducts: number
  maxPoseImages: number
  costStandard: number
  costHigh: number
  costExtraProduct: number
  costEditorial: number
  costEditorialHigh: number
  costPosePerImage: number
}

/** Studyo araclari - sunucudaki `AiGenerationKind` ile birebir. */
export type AiKind = 'FASHION_MODEL' | 'EDITORIAL' | 'POSE'

export interface AiQuote {
  cost: number
  balance: number
  affordable: boolean
}

export type AiGenerationStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface AiGeneration {
  id: string
  status: AiGenerationStatus
  kind: string
  creditCost: number
  /** Sonuç görselinin imzalı adresi; henüz bitmediyse `null`. */
  imageUrl: string | null
  mediaId: string | null
  errorMessage: string | null
  productCount: number
  createdAt: string
}

/** Manken ayarları — sunucudaki `FashionModelRequest` ile birebir. */
export interface FashionModelParams {
  productMediaIds: string[]
  gender: string
  ethnicity: string
  age: string
  skinTone: string
  faceType: string
  eyeColor: string
  expression: string
  hairColor: string
  hairstyle: string
  bodySize: string
  heightCm: number
  shot: string
  background: string
  highQuality: boolean
}

export async function getAiOptions(): Promise<AiOptions> {
  return (await api.get<AiOptions>('/ai/options')).data
}

/**
 * Maliyet - **sorulur, hesaplanmaz**.
 *
 * `count` aracin anlamina gore okunur: mankende urun sayisi, pozda gorsel
 * sayisi, editoryalde kullanilmaz. Tek uc olmasi bilinclidir: uc arac da ayni
 * soruyu sorar ve formulu asla kopyalamaz.
 */
export async function quoteAi(kind: AiKind, highQuality: boolean, count: number): Promise<AiQuote> {
  return (
    await api.get<AiQuote>('/ai/quote', { params: { kind, highQuality, productCount: count } })
  ).data
}

export async function quoteFashion(highQuality: boolean, productCount: number): Promise<AiQuote> {
  return quoteAi('FASHION_MODEL', highQuality, productCount)
}

/**
 * Üretimi başlatır. Yanıt <b>hemen</b> döner ve durumu {@code QUEUED}'dur —
 * sonuç {@link getGeneration} ile yoklanır.
 */
export async function createFashionModel(params: FashionModelParams): Promise<AiGeneration> {
  return (await api.post<AiGeneration>('/ai/fashion-model', params, { timeout: 60_000 })).data
}

export async function listGenerations(limit = 30): Promise<AiGeneration[]> {
  return (await api.get<AiGeneration[]>('/ai/generations', { params: { limit } })).data
}

export async function getGeneration(id: string): Promise<AiGeneration> {
  return (await api.get<AiGeneration>(`/ai/generations/${id}`)).data
}

/** Kredi bakiyesi — stüdyonun üst şeridinde ve kredi kartında gösterilir. */
export interface CreditSummary {
  balance: number
  /** Bu üyelik döneminin toplam hakkı (ilerleme çubuğu için). */
  perPeriod: number
  plan: string
  spentTotal: number
  renewsAt: string | null
  /**
   * Yapay zekâ stüdyosu bu hesapta açık mı.
   *
   * 🔴 18 Ağu 2026 — artık "ücretli üyelik şart" DEĞİL: ücretsiz hesapta da
   * `trialRemaining > 0` olduğu sürece **açıktır**. Bu yüzden ekranlar plan
   * adına değil bu bayrağa bakmaya devam etmeli.
   */
  aiEnabled: boolean
  /**
   * Ücretsiz **tek kullanımlık** deneme hakkından kalan kredi (18 Ağu 2026).
   *
   * ⚠️ `balance` ile aynı şey **değil**: ücretsiz hesapta harcamanın gerçek
   * tavanı budur. Bakiyeye bakıp "yeter" demek, üyeliği bitmiş bir Premium'un
   * artakalan kredisini de harcanabilir gösterirdi — sunucu o isteği reddeder.
   */
  trialRemaining: number
}

export async function getCredits(): Promise<CreditSummary> {
  return (await api.get<CreditSummary>('/users/me/credits')).data
}

/* ══════════════════════════════════════════════════ 99. tur — iki yeni araç */

/**
 * <b>Editoryal / Değişim</b> isteği — sunucudaki `EditorialRequest` ile birebir.
 *
 * ⚠️ "Editoryal mi, değişim mi" alanı **yok** ve olmamalı: fark, birinci
 * görselde bir insan olup olmamasıdır — yani modelin *gördüğü* bir şey. Bunu
 * kullanıcıya sormak, yanlış cevabın sessizce kötü bir çıktı üretmesi demekti.
 */
export interface EditorialParams {
  subjectMediaId: string
  styleMediaId: string
  aspectRatio: string
  highQuality: boolean
}

/** <b>Poz</b> isteği — `creativity`: `STANDARD` | `CREATIVE`. */
export interface PoseParams {
  sceneMediaId: string
  creativity: string
  imageCount: number
}

export async function createEditorial(params: EditorialParams): Promise<AiGeneration> {
  return (await api.post<AiGeneration>('/ai/editorial', params, { timeout: 60_000 })).data
}

/**
 * Poz üretimi — **liste** döner.
 *
 * 🔴 İstenen her görsel sunucuda **ayrı bir satırdır**: her birinin kendi
 * durumu, kendi kredisi ve kendi iade yolu var. Tek kimlik dönseydi arayüz
 * kalan iki görselin ne olduğunu hiç gösteremezdi.
 */
export async function createPose(params: PoseParams): Promise<AiGeneration[]> {
  return (await api.post<AiGeneration[]>('/ai/pose', params, { timeout: 60_000 })).data
}
