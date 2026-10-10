import { useEffect, useState } from 'react'
import { AtSign, Check, Loader2 } from 'lucide-react'
import { api, apiErrorMessage } from '@/lib/api'
import { toast } from '@/components/ui/toast'
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
 * <b>Ayarlar → Kullanıcı adı</b> (17 Ağu 2026, kullanıcı isteği).
 *
 * <p>⚠️ Profil bölümünün İÇİNE konmadı, ayrı bir bölüm oldu: ad değişikliği
 * <b>vitrin adresini</b> değiştirir ({@code waydee.com/{username}}), bekleme
 * süresine tabidir ve denetim kaydı üretir. Görünen ad ya da bio ile aynı
 * kutuda durması, geri dönüşü olan bir düzenleme gibi okunurdu.
 *
 * <p>⚠️ Uyarı metni <b>her zaman</b> görünür: kullanıcı adresinin değişeceğini
 * kaydettikten sonra değil, önce bilmeli — paylaştığı eski bağlantılar kırılır.
 */
export function UsernameSection({
  user,
  setUser,
}: {
  user: UserResponse | null
  setUser: (u: UserResponse) => void
}) {
  const t = useT()
  const current = user?.username ?? ''
  const [value, setValue] = useState(current)
  const [check, setCheck] = useState<Availability | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => setValue(current), [current])

  useEffect(() => {
    const next = value.trim().toLowerCase()
    if (next === current || !FORMAT.test(next)) {
      setCheck(null)
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
  }, [value, current])

  const normalized = value.trim().toLowerCase()
  const changed = normalized !== current
  const canSave = !busy && changed && FORMAT.test(normalized) && check?.available === true

  const save = async () => {
    setBusy(true)
    try {
      const res = await api.patch<UserResponse>('/users/me/username', { username: normalized })
      setUser(res.data)
      toast.success(t('username.saved'))
    } catch (err) {
      /* ⚠️ Bekleme süresi hatası da BURADA görünür: sunucunun mesajı kaç gün
         kaldığını söylüyor, onu yutmak kullanıcıyı kör bırakırdı. */
      toast.error(apiErrorMessage(err, t('common.failed')))
    } finally {
      setBusy(false)
    }
  }

  const hint = () => {
    if (!changed) return null
    if (!FORMAT.test(normalized)) return { ok: false, text: t('username.badFormat') }
    if (checking) return null
    if (check?.available) return { ok: true, text: t('username.available') }
    if (check?.reason === 'RESERVED') return { ok: false, text: t('username.reserved') }
    if (check?.reason === 'TAKEN') return { ok: false, text: t('username.taken') }
    return null
  }
  const h = hint()

  return (
    <div className="flex flex-col gap-3">
      <label className="waydee-username-field">
        <AtSign className="h-4 w-4 shrink-0 text-faint" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          aria-label={t('username.title')}
        />
        {checking && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" />}
        {!checking && h?.ok && <Check className="h-4 w-4 shrink-0 text-ok" />}
      </label>

      <p className={`waydee-username-hint ${h && !h.ok ? 'waydee-username-hint-bad' : ''}`}>
        {h?.text ?? ' '}
      </p>

      <p className="text-[12px] text-faint">
        {t('username.addressPreview')}{' '}
        <span className="font-semibold text-ink">waydee.com/{normalized || '…'}</span>
      </p>

      {/* 🔴 Uyarı kaydetmeden ÖNCE: eski adres kırılır, geri alması bekleme
          süresine takılır. Sonradan söylemek özür dilemektir. */}
      <p className="text-[12px] text-muted">{t('username.changeWarning')}</p>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={!canSave} className="waydee-sheet-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
        </button>
      </div>
    </div>
  )
}
