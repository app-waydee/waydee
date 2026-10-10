import { Component, type ReactNode } from 'react'

/**
 * <b>Sahne hata sınırı</b> — 3B tarafında ne olursa olsun ekran boş kalmaz.
 *
 * <p>🔴 11 Ağu 2026. Bildirilen hata: *"bazen 3B ekranı tam yüklenmiyor ve
 * arka plan gri bir ekranda kalıyor, mağazalar gelmiyor"*.
 *
 * <p>Kök neden {@link useSafeTexture}'da anlatıldığı gibi askıya alan doku
 * yüklemesiydi ve orada kalıcı olarak çözüldü. Bu sınır <b>ikinci savunma
 * hattıdır</b>: WebGL bağlamı kaybı, sürücü hatası, bilinmeyen bir üçüncü
 * taraf istisnası… Hangisi olursa olsun kullanıcı <b>boş gri bir tuval</b>
 * değil, ne olduğunu söyleyen ve yeniden denemesini sağlayan bir ekran görür.
 *
 * <p>⚠️ Hata sınırı <b>sınıf bileşeni olmak zorunda</b>: React'te
 * `componentDidCatch`/`getDerivedStateFromError`in kanca karşılığı yoktur.
 *
 * <p>⚠️ Sınır `<Canvas>`'ın <b>DIŞINDA</b> durmalı. İçine konsaydı, hata
 * hâlinde çizilecek yedek arayüz R3F ağacına ait olurdu ve orada bir `<div>`
 * çizilemez — three.js düğümleri HTML değildir.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    /* Sessiz yutmuyoruz: bir dahaki "gri ekran" şikâyetinde konsolda
       gerçek yığın izi bulunsun. Yutulan hata teşhis edilemez (69. tur). */
    console.error('[3B evren] sahne düştü:', error)
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback(() => this.setState({ failed: false }))
    }
    return this.props.children
  }
}
