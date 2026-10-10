import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { decodeToken, sessionIsConsistent } from '@/lib/tokenClaims'
import type { TokenResponse, UserResponse } from '@/types/api'

interface AuthState {
  user: UserResponse | null
  accessToken: string | null
  refreshToken: string | null
  setSession: (tokens: TokenResponse) => void
  setUser: (user: UserResponse) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (tokens) =>
        set({
          user: tokens.user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'waydee-auth',
      /**
       * 🔴 <b>KURTARMADA OTURUM DOĞRULANIR</b> (19 Ağu 2026).
       *
       * <p>Oturum {@code localStorage}'da duruyor ve <b>kullanıcı elle
       * düzenleyebilir</b> — DevTools → Application → Local Storage. Kalıcı
       * nesnedeki {@code role}/{@code id}, token'ın söylediğiyle uyuşmuyorsa
       * oturum <b>bozulmuştur</b> ve komple atılır.
       *
       * <p>⚠️ Kısmi düzeltme (yalnız rolü token'dan yaz) YAPILMADI: elle
       * oynanmış bir oturumun geri kalanına da güvenilmez. Doğru davranış,
       * kullanıcıyı yeniden giriş yapmaya zorlamaktır.
       *
       * <p>⚠️ Bu bir <b>arayüz</b> savunmasıdır, güvenlik sınırı DEĞİL. Gerçek
       * kapı sunucudadır: yetki imzalı token'dan okunur ve
       * {@code /api/v1/admin/**} {@code hasRole("ADMIN")} ile korunur.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!sessionIsConsistent(state.user, state.accessToken)) {
          state.clear()
        }
      },
    },
  ),
)

/**
 * <b>Yönetici mi?</b> — cevap <b>TOKEN'dan</b> gelir, kalıcı nesneden değil.
 *
 * <p>🔴 Eskiden {@code user?.role === 'ADMIN'} idi ve {@code user} nesnesi
 * {@code localStorage}'dan geliyordu: DevTools'ta o alanı <b>ADMIN</b> yapan
 * biri yönetici yüzeylerini açtırabiliyordu. Token'ı değiştirmek ise
 * <b>imzayı bozar</b> ve sunucu 401 döner.
 *
 * <p>⚠️ Yine de tek gerçek kapı sunucudur; bu yalnız arayüzün elle düzenlenmiş
 * bir alana güvenmesini engeller.
 */
export const isAdmin = (user: UserResponse | null) => {
  void user // imza korunuyor: çağıranlar değişmesin
  return decodeToken(useAuthStore.getState().accessToken)?.role === 'ADMIN'
}

/** Oturumdaki gerçek kullanıcı kimliği — token'dan. */
export const currentUserId = () =>
  decodeToken(useAuthStore.getState().accessToken)?.userId ?? null
