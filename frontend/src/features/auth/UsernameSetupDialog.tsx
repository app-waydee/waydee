import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AtSign, Check, Loader2, X } from 'lucide-react'
import { api, apiErrorMessage } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { toast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import type { UserResponse } from '@/types/api'

/** Sunucudaki {@code UsernamePolicy.FORMAT} ile BİREBİR aynı. */
const FORMAT = /^[a-z0-9_]{3,30}$/

interface Availability {
  username: string
  available: boolean
  reason: 'FORMAT' | 'RESERVED' | 'TAKEN' | null
}

/**
 * <b>Kullanıcı adı seçim ekranı</b> — Google ile açılan hesabın ilk girişi.
 *
 * <h3>🔴 17 Ağu 2026 — neden yazıldı</h3>
 * Kullanıcı: <i>"gmail ile giriş yapınca otomatik olarak gmail adını aldı;
 * ilk girişte soft şekilde bir username ekranı aç"</i>.
 *
 * <p>Google akışında kullanıcı adı e-posta yerel kısmından <b>türetiliyordu</b>
 * ({@code kullanici1234@gmail.com} → {@code kullanici1234}) ve
 * kullanıcıya hiç sorulmuyordu. Oysa bu ad kişinin <b>vitrin adresidir</b>
 * ({@code waydee.com/{username}}) — ürünün en görünür parçası.
 *
 * <h3>Neden "yumuşak"</h3>
 * <p>⚠️ Kapatılabilir ve <b>atlanabilir</b>: kullanıcıyı ilk saniyede bir
 * karara zorlamak, henüz ürünü görmemişken verilen kötü bir karar demektir.
 * Atlayan kişi üretilen adla devam eder ve bayrak <b>açık kalır</b> — soru
 * bir sonraki girişte yeniden sorulur. Bu yüzden bayrak sunucuda kalıcı bir
 * kolondur, oturumda taşınan geçici bir işaret değil.
 *
 * <p>⚠️ "Bu ad iyi" diyen tek tıkla geçer ({@code keepGeneratedUsername}) ve
 * bu <b>bekleme süresini tüketmez</b> — adı değiştirmedi, yalnız onayladı.
 */
export function UsernameSetupDialog({ onDone }: { onDone: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [value, setValue] = useState(me?.username ?? '')
  const [check, setCheck] = useState<Availability | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unlock = lockScroll()
    inputRef.current?.focus()
    inputRef.current?.select()
    return unlock
  }, [])

  /*
   * Canlı uygunluk kontrolü — 350 ms geciktirilir.
   * ⚠️ Her tuşta istek atmak hem sunucuyu yorar hem de yanıtlar sırasız
   * dönerse eski bir cevabı "güncel" sanmaya yol açar. Gecikme + son
   * isteğin kazanması (`stale`) ikisini birden çözer.
   */
  useEffect(() => {
    const next = value.trim().toLowerCase()
    if (!FORMAT.test(next)) {
      setCheck(next.length === 0 ? null : { username: next, available: false, reason: 'FORMAT' })
      return
    }
    let stale = false
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<Availability>('/users/me/username-available', {
          params: { u: next },
        })
        if (!stale) setCheck(res.data)
      } catch {
        // Ağ hatasında engelleme yok: son karar zaten sunucuda verilir.
        if (!stale) setCheck(null)
      } finally {
        if (!stale) setChecking(false)
      }
    }, 350)
    return () => {
      stale = true
      clearTimeout(timer)
      setChecking(false)
    }
  }, [value])

  const submit = async (username: string) => {
    setBusy(true)
    try {
      const res = await api.patch<UserResponse>('/users/me/username', { username })
      setUser(res.data)
      await qc.invalidateQueries({ queryKey: ['my-plan'] })
      toast.success(t('username.saved'))
      onDone()
    } catch (err) {
      // ⚠️ Yakalanmamış `await` = "hiçbir şey olmuyor" (vault kuralı).
      toast.error(apiErrorMessage(err, t('common.failed')))
    } finally {
      setBusy(false)
    }
  }

  const normalized = value.trim().toLowerCase()
  const unchanged = normalized === (me?.username ?? '')
  const canSave = !busy && FORMAT.test(normalized) && (unchanged || check?.available === true)

  const hint = () => {
    if (!normalized) return null
    if (!FORMAT.test(normalized)) return { ok: false, text: t('username.badFormat') }
    if (unchanged) return { ok: true, text: t('username.keepHint') }
    if (checking) return null
    if (check?.available) return { ok: true, text: t('username.available') }
    if (check?.reason === 'RESERVED') return { ok: false, text: t('username.reserved') }
    if (check?.reason === 'TAKEN') return { ok: false, text: t('username.taken') }
    return null
  }
  const h = hint()

  return createPortal(
    <div className="waydee-sheet-scrim" role="dialog" aria-modal="true">
      <div className="waydee-sheet">
        <div className="relative mb-1">
          <h2 className="text-center text-[15px] font-bold text-ink">{t('username.title')}</h2>
          {/* ⚠️ Kapatmak = "sonra sorarım". Bayrak sunucuda açık kalır. */}
          <button
            type="button"
            onClick={onDone}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="mb-4 text-center text-[13px] text-muted">{t('username.subtitle')}</p>

        <label className="waydee-username-field">
          <AtSign className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={value}
            /* Girdi anında normalize edilir: kullanıcı büyük harf yazınca
               "geçersiz" demek yerine sessizce düzeltmek daha nazik. */
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            aria-label={t('username.title')}
          />
          {checking && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" />}
          {!checking && h?.ok && <Check className="h-4 w-4 shrink-0 text-ok" />}
        </label>

        {/* ⚠️ Yuva KOŞULSUZ: mesaj geldiğinde düğmeler aşağı kaymasın
            (vault kuralı — isteğe bağlı alan yerleşimi oynatmamalı). */}
        <p className={`waydee-username-hint ${h && !h.ok ? 'waydee-username-hint-bad' : ''}`}>
          {h?.text ?? ' '}
        </p>

        <p className="mt-1 text-center text-[12px] text-faint">
          waydee.com/<span className="font-semibold text-ink">{normalized || '…'}</span>
        </p>

        <div className="mt-5 flex items-center justify-end gap-4">
          <button type="button" onClick={onDone} disabled={busy} className="waydee-sheet-cancel">
            {t('username.later')}
          </button>
          <button
            type="button"
            onClick={() => submit(normalized)}
            disabled={!canSave}
            className="waydee-sheet-submit"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
