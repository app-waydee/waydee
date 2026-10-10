import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { CropDialog } from '@/components/media/CropDialog'
import { StoreCategoryIcon } from '@/components/StoreCategoryIcon'
import { api, apiErrorMessage } from '@/lib/api'
import { useStoreCategories, useStoreCategoryLabel } from '@/lib/storeCategories'
import { looksLikeImage, prepareImageForUpload, uploadImage } from '@/lib/media'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { TerritoryResponse } from '@/types/api'
import {
  DEFAULT_STYLE,
  TerritoryStylePicker,
  type TerritoryStyleDraft,
} from '@/features/map/TerritoryStylePicker'

/**
 * <b>Mağaza ayarlarının TEK kaynağı</b> (24 Ağu 2026).
 *
 * <p>Kullanıcı talimatı: *"me kısmında mağaza kısmına da tüm ayarları taşı"*.
 *
 * <h3>🔴 Neden ortak bileşen, neden ikinci bir form değil</h3>
 * <p>Aynı ayarlar artık <b>iki yerde</b> düzenleniyor: haritadaki
 * {@code StoreEditPanel} ve {@code /me}'deki mağaza penceresi. İkinci bir form
 * yazmak, bu projede daha önce ölçülmüş bir hatayı davet ederdi — `ui/` ve
 * `dash/` bileşenleri iki app'te kopya olduğu için "birinde değiştirdim,
 * diğerini unuttum" defalarca yaşandı (vault 02). Burada kopya <b>yok</b>:
 * alanlar, doğrulama ve kaydetme tek yerde.
 *
 * <h3>⚠️ Harita önizlemesi OPSİYONEL</h3>
 * <p>{@code onPreview} yalnız harita panelinden gelir; {@code /me}'de
 * önizlenecek bir harita yoktur. Zorunlu yapılsaydı {@code /me} boş bir geri
 * çağırma uydurmak zorunda kalırdı ve "burada neden bir şey olmuyor?"
 * sorusunu koda gömerdi.
 *
 * <h3>🔴 Silme burada, ve iki kademeli</h3>
 * <p>Mağaza silmek geri alınamaz (yeniden açmak yeni bir yer seçmeyi ve —
 * ücretsiz hesapta — harcanmış bir deneme hakkını gerektirir). Tek tıkla
 * silinebilseydi yanlışlıkla basan kullanıcı mağazasını kaybederdi. İkinci
 * adım <b>aynı kart içinde</b> açılır; ayrı bir modal, kullanıcıyı ne
 * sildiğini görmediği bir ekrana taşırdı.
 */
interface Props {
  store: TerritoryResponse
  /**
   * Sunucunun çözdüğü GERÇEK renk (kullanıcı seçmediyse otomatik palet rengi).
   * Haritada bu bilgi feature'da durur; {@code /me}'de yoktur ve o zaman
   * kayıtlı renge düşülür.
   */
  currentColor?: string
  /** Taslağı haritadaki gerçek işaretçiye uygular; `null` → sunucudaki hâline dön. */
  onPreview?: (draft: TerritoryStyleDraft | null) => void
  /** Kaydetme/silme sonrası kapanış (panel ya da pencere). */
  onDone?: () => void
  /** Silindiğinde ayrıca haber ver (harita seçimi temizlensin). */
  onDeleted?: () => void
}

export function StoreSettingsForm({ store, currentColor, onPreview, onDone, onDeleted }: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const { data: categories } = useStoreCategories()
  const categoryLabel = useStoreCategoryLabel()

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [name, setName] = useState(store.name)
  const trimmedName = name.trim()
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 60

  const [categoryId, setCategoryId] = useState<string | null>(store.category?.id ?? null)

  /*
   * KAPAK — üç durum var ve ikisi karıştırılamaz: "dokunmadı"
   * (`coverMediaId === undefined`), "yeni fotoğraf" ve "kaldırdı"
   * (`coverCleared`). Tek bir `string | null` alanla idare edilseydi `null`
   * hem "dokunmadı" hem "kaldır" demek zorunda kalır ve yalnız adını
   * değiştiren kullanıcı kapağını da silerdi.
   */
  const [coverMediaId, setCoverMediaId] = useState<string | undefined>(undefined)
  /** Kırpma penceresinde bekleyen dosya — seçilen ham görsel. */
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(store.coverUrl)
  const [coverCleared, setCoverCleared] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [draft, setDraft] = useState<TerritoryStyleDraft>(() => ({
    ...DEFAULT_STYLE,
    /*
     * ⚠️ `style.strokeColor` YETMEZ: kullanıcı hiç renk seçmediyse orası
     * `null`dır ve gerçek renk sunucuda sahibin kimliğinden türeyen otomatik
     * palet rengidir. O renk yalnız HARİTA verisinde durur — bu yüzden
     * dışarıdan gelir, yoksa form maviyi gösterip harita moru çizerdi.
     */
    strokeColor: store.style?.strokeColor ?? currentColor ?? DEFAULT_STYLE.strokeColor,
    fillColor:
      store.style?.fillColor ?? store.style?.strokeColor ?? currentColor ?? DEFAULT_STYLE.fillColor,
    fillOpacity: store.style?.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
    strokeWidth: store.style?.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
    effect: store.style?.effect ?? 'NONE',
  }))

  /*
   * Her taslak değişikliğinde harita tazelenir.
   * ⚠️ Kapanırken önizleme MUTLAKA geri alınır: yoksa kullanıcı vazgeçse bile
   * haritada denediği renk asılı kalırdı.
   */
  useEffect(() => {
    onPreview?.(draft)
  }, [draft, onPreview])
  useEffect(() => () => onPreview?.(null), [onPreview])

  /**
   * <b>Kapak seçildi → önce KIRP.</b>
   *
   * <p>🔴 25 Ağu 2026 (kullanıcı isteği): kapak, profil fotoğrafı ve hikayenin
   * aksine <b>olduğu gibi</b> yükleniyordu. Panelde 16/9 kırpılarak
   * gösterildiği için kullanıcının seçtiği fotoğrafın nesi görüneceğini
   * <b>tarayıcı</b> belirliyordu: dikey bir fotoğrafın ortası, bazen de kafası
   * kesilmiş bir görsel. Artık çerçeveyi kullanıcı seçiyor.
   *
   * <p>⚠️ Oran {@code 16/9} — panelde çizildiği oranın <b>aynısı</b>. Başka bir
   * oranla kırptırmak, burada gördüğüyle mağazasında göreceğini ayırırdı.
   */
  function pickCoverFile(file: File | undefined) {
    if (!file) return
    if (!looksLikeImage(file)) {
      toast.error(t('storeEdit.coverInvalid'))
      return
    }
    setCropFile(file)
    /* 🔴 FileList tuzağı: girdi BURADA da temizlenir. Kırpma iptal edilirse
       `pickCover` hiç çalışmaz ve aynı dosya ikinci kez seçilemezdi. */
    if (fileRef.current) fileRef.current.value = ''
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const prepared = await prepareImageForUpload(file)
      const media = await uploadImage(prepared)
      setCoverMediaId(media.id)
      setCoverCleared(false)
      setCoverPreview(media.url)
    } catch (error) {
      toast.error(apiErrorMessage(error, t('storeEdit.coverFailed')))
    } finally {
      setUploading(false)
      /* 🔴 FileList tuzağı: girdi temizlenmezse AYNI dosya ikinci kez
         seçildiğinde `change` hiç tetiklenmez ve kullanıcı "çalışmıyor" der. */
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Kaydettikten/sildikten sonra mağazayı okuyan HER yüzey tazelenmeli. */
  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-territories'] }),
      /* 🔴 Haritanın kendi verisi — yoksa kullanıcı kaydeder, önizleme geri
         alınır ve işaretçi ESKİ hâline döner ("kaydetmedi" sanır). */
      queryClient.invalidateQueries({ queryKey: ['map', 'territories'] }),
      queryClient.invalidateQueries({ queryKey: ['territory-card'] }),
    ])
  }

  async function save() {
    setSaving(true)
    try {
      await api.patch(`/territories/${store.id}`, {
        /* ⚠️ Değişmeyen alan GÖNDERİLMEZ: sunucu sözleşmesinde `null` =
           "dokunma" ve her kaydetmede aynı değeri yollamak gereksiz bir
           yazma üretirdi. */
        name: trimmedName !== store.name ? trimmedName : undefined,
        style: draft,
        categoryId: categoryId !== (store.category?.id ?? null) ? categoryId ?? undefined : undefined,
        coverMediaId,
        clearCover: coverCleared || undefined,
      })
      await invalidate()
      toast.success(t('storeEdit.saved'))
      onDone?.()
    } catch (error) {
      toast.error(apiErrorMessage(error, t('common.failed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      await api.delete(`/territories/${store.id}`)
      await invalidate()
      toast.success(t('storeEdit.deleted'))
      /* ⚠️ Önce önizlemeyi geri al: silinen mağazanın taslağı haritada
         asılı kalmamalı. */
      onPreview?.(null)
      onDeleted?.()
      onDone?.()
    } catch (error) {
      toast.error(apiErrorMessage(error, t('common.failed')))
    } finally {
      setDeleting(false)
    }
  }

  const busy = saving || deleting || uploading

  return (
    <div className="space-y-5">
      {/* ───────── kapak ───────── */}
      <div className="space-y-1.5">
        <Label>{t('storeEdit.cover')}</Label>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-subtle">
          {/* ⚠️ Oran SABİT (16/9): mağaza panelinde kapak bu oranla kırpılıyor;
              düzenlemede başka bir oran göstermek, kullanıcının burada
              gördüğüyle mağazasında göreceğini ayırırdı. */}
          <div className="aspect-[16/9] w-full">
            {coverPreview && !coverCleared ? (
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
                <ImagePlus className="h-6 w-6" />
                <span className="text-[12px] font-semibold">{t('storeEdit.coverEmpty')}</span>
              </div>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-ink/35 backdrop-blur-sm">
              <Spinner className="h-5 w-5 text-white" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="stroke"
            className="flex-1"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {coverPreview && !coverCleared ? t('storeEdit.coverChange') : t('storeEdit.coverAdd')}
          </Button>
          {coverPreview && !coverCleared && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={t('storeEdit.coverRemove')}
              onClick={() => {
                /* ⚠️ Kaldırma TASLAKTA kalır; sunucuya `clearCover` olarak
                   KAYDET'te gider. Anında silseydik "vazgeç" kapağı geri
                   getiremezdi. */
                setCoverCleared(true)
                setCoverMediaId(undefined)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickCoverFile(e.target.files?.[0])}
        />
      </div>

      {/* ───────── ad ───────── */}
      <div className="space-y-1.5">
        <Label htmlFor="store-name">{t('storeEdit.name')}</Label>
        <Input
          id="store-name"
          value={name}
          maxLength={60}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
        {!nameValid && (
          <p className="text-[12px] font-medium text-danger">{t('storeEdit.nameHint')}</p>
        )}
      </div>

      {/* ───────── kategori ───────── */}
      {(categories?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <Label>{t('storeEdit.category')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {(categories ?? []).map((category) => {
              const active = categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => setCategoryId(active ? null : category.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-bold transition-colors disabled:opacity-60',
                    active ? 'bg-ink text-on-ink' : 'bg-subtle text-muted hover:text-ink',
                  )}
                >
                  <StoreCategoryIcon
                    name={category.icon}
                    className="h-3.5 w-3.5"
                    color={category.color}
                  />
                  {categoryLabel(category)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ───────── görünüm ─────────
          ⚠️ Önizlemedeki ad, kutuya YAZILAN addır (kayıtlı ad değil):
          kullanıcı adını değiştirirken rozetin nasıl duracağını anında
          görmeli. */}
      <TerritoryStylePicker
        value={draft}
        onChange={setDraft}
        avatarUrl={store.ownerAvatarUrl}
        name={name}
      />

      {/* ───────── kaydet ───────── */}
      <div className="flex items-center gap-2">
        {onDone && (
          <Button variant="stroke" className="flex-1" onClick={onDone} disabled={busy}>
            {t('common.cancel')}
          </Button>
        )}
        <Button className="flex-1" onClick={() => void save()} disabled={busy || !nameValid}>
          {saving ? <Spinner className="h-4 w-4" /> : t('common.save')}
        </Button>
      </div>

      {/* ───────── tehlikeli bölge ─────────
          ⚠️ Ayrı bir başlık ve üstte bir çizgi: silme, yukarıdaki kaydet
          akışının bir parçası değil ve onun yanında durursa yanlışlıkla
          basılır. */}
      <div className="border-t border-line pt-4">
        {!confirmDelete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t('storeEdit.delete')}
          </button>
        ) : (
          <div className="rounded-2xl border border-danger/35 bg-danger/8 p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-danger">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {t('storeEdit.deleteConfirmTitle')}
            </p>
            <p className="mt-1 text-[12.5px] font-medium leading-snug text-muted">
              {t('storeEdit.deleteConfirmBody')}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="stroke"
                size="sm"
                className="flex-1"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                disabled={deleting}
                onClick={() => void remove()}
              >
                {deleting ? <Spinner className="h-4 w-4" /> : t('storeEdit.deleteConfirm')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ───────── kapak kırpma ─────────
          ⚠️ Kırpılmış dosya doğrudan yüklemeye gider; ham dosya hiç
          gönderilmez. `CropDialog` sabit oranda JPEG üretiyor. */}
      {cropFile && (
        <CropDialog
          file={cropFile}
          aspect={16 / 9}
          title={t('storeEdit.coverCrop')}
          onCancel={() => setCropFile(null)}
          onDone={(cropped) => {
            setCropFile(null)
            void pickCover(cropped)
          }}
        />
      )}
    </div>
  )
}
