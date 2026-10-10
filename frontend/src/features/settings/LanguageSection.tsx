import { useState } from 'react'
import { Check, Globe, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { updateMe } from '@/lib/account'
import { cn } from '@/lib/utils'
import { LOCALE_META, LOCALES, useT, type Locale } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import { useAuthStore } from '@/stores/auth'

/**
 * Dil seçimi.
 *
 * ⚠️ İki katmanlı kayıt: seçim önce <b>anında</b> uygulanır (sözlük indirilir,
 * `<html lang/dir>` döner), sonra <b>hesaba</b> yazılır. Sunucu yazımı
 * beklenmez — ağ yavaşken kullanıcı düğmeye bastığında hiçbir şey olmuyormuş
 * gibi görünmemeli. Yazım başarısız olursa arayüz dili yine değişir, yalnız
 * başka bir cihazda geçerli olmaz ve kullanıcı uyarılır.
 */
export function LanguageSection() {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const explicit = useI18nStore((s) => s.explicit)
  const setLocale = useI18nStore((s) => s.setLocale)
  const useSystemLocale = useI18nStore((s) => s.useSystemLocale)
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)
  const [saving, setSaving] = useState<Locale | 'system' | null>(null)

  const choose = async (next: Locale) => {
    setSaving(next)
    try {
      await setLocale(next)
      const updated = await updateMe({ locale: next })
      setUser(updated)
      toast.success(t('settings.languageSaved'))
    } catch {
      // Dil yerelde değişti; yalnız hesaba yazılamadı.
      toast.error(t('settings.languageSaved'))
    } finally {
      setSaving(null)
    }
  }

  const chooseSystem = async () => {
    setSaving('system')
    try {
      await useSystemLocale()
      // Hesaptaki kaydı temizlemek için boş dizi gönderilemez (Pattern doğrulaması
      // reddeder); bu yüzden çözülen dil yazılır — davranış aynıdır, kullanıcı
      // cihaz dilini görür.
      const updated = await updateMe({ locale: useI18nStore.getState().locale })
      setUser(updated)
      toast.success(t('settings.languageSaved'))
    } catch {
      toast.error(t('settings.languageSaved'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium leading-snug text-muted">{t('settings.languageDesc')}</p>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code]
          const selected = explicit && locale === code
          return (
            <button
              key={code}
              type="button"
              onClick={() => void choose(code)}
              disabled={saving !== null}
              aria-pressed={selected}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
                selected ? 'border-ink bg-subtle' : 'border-line hover:bg-subtle',
              )}
            >
              <span className="text-[20px] leading-none">{meta.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{meta.native}</span>
                <span className="block truncate text-[11.5px] font-medium text-faint">
                  {code.toUpperCase()}
                  {meta.dir === 'rtl' && ' · RTL'}
                </span>
              </span>
              {saving === code ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
              ) : (
                selected && <Check className="h-4 w-4 shrink-0 text-success" />
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => void chooseSystem()}
        disabled={saving !== null}
        aria-pressed={!explicit}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
          !explicit ? 'border-ink bg-subtle' : 'border-line hover:bg-subtle',
        )}
      >
        <Globe className="h-4.5 w-4.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{t('settings.languageSystem')}</span>
          <span className="block text-[11.5px] font-medium leading-snug text-faint">
            {t('settings.languageSystemHint')}
          </span>
        </span>
        {saving === 'system' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
        ) : (
          !explicit && <Check className="h-4 w-4 shrink-0 text-success" />
        )}
      </button>

      {!user && (
        <p className="text-[12px] font-medium text-faint">
          {t('settings.languageSystemHint')}
        </p>
      )}
    </div>
  )
}
