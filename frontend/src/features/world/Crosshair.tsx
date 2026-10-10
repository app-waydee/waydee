import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { WorldShelfItem, WorldStore } from '@/lib/marketplace'

/** Nişangâhın bir ürünü hedefleyebileceği azami uzaklık (metre). */
const REACH = 6

/**
 * Hedeflenen ürünün vurgu rengi — mağazanın fıstık yeşili.
 *
 * <p>⚠️ Vurgu <b>`emissive`</b> üzerinden yapılır, `color` üzerinden değil:
 * `color` malzemenin JSX özelliğidir ve bileşen yeniden çizildiğinde (örneğin
 * raf fotoğrafı geç yüklendiğinde) R3F onu özgün değerine geri yazar —
 * vurgu sessizce kaybolurdu. `emissive`e kimse dokunmuyor.
 */
const HIGHLIGHT = new THREE.Color('#b6f13f')

/**
 * Bir rafın kutusuna iliştirilen veri. {@link StoreBuilding} yazar, burası okur.
 *
 * <p>⚠️ Sahne nesnesine veri iliştirmek (`userData`) bilinçli: ışın testi geriye
 * <b>three.js nesnesi</b> döndürür, React bileşeni değil. Kimlikle bir sözlükte
 * arama yapmak, her karede bir arama daha demekti.
 */
export interface ShelfTarget {
  shelfItem: WorldShelfItem
  store: WorldStore
}

/**
 * <b>Nişangâhın hedefleyebildiği şeyler</b> (97. tur).
 *
 * <p>🔴 Raf ürünü artık tek hedef değil: mağazanın içindeki <b>kalp
 * düğmesi</b> de nişangâhla hedefleniyor. Ayrı bir ref/ayrı bir ışın testi
 * açmak yerine hedef <b>etiketli</b> hâle getirildi — iki ışın testi her
 * karede iki kat maliyet demekti ve ikisi aynı anda hedeflenebilseydi
 * tıklamanın hangisine gideceği belirsiz olurdu.
 */
export type AimTarget =
  | ({ kind: 'shelf' } & ShelfTarget)
  | { kind: 'like'; store: WorldStore }

/**
 * Vurguyu geri alır — `emissive` eski değerine döner.
 *
 * 🔴 15 Ağu 2026 — İKİ SAVUNMA EKLENDİ:
 *
 * ① **`emissive` alanı olmayan malzeme**: `MeshBasicMaterial`de böyle bir alan
 *    <b>yoktur</b> ve `m.emissive.setRGB(...)` çalışma zamanında patlar. Işın
 *    artık raf fotoğrafına da çarptığı için bu ihtimal gerçek.
 *
 * ② **Eski değer geri yüklenir, siyaha ZORLANMAZ.** Raf fotoğrafı kendi
 *    kendine aydınlanıyor (`emissive` beyaz + `emissiveMap`); körü körüne
 *    siyaha çekmek, hedeften çıkınca fotoğrafı <b>kapkara</b> bırakırdı.
 */
function unlight(mesh: THREE.Mesh) {
  const m = mesh.material as THREE.MeshStandardMaterial
  if (!m?.emissive) return
  /*
   * 🔴 15 Ağu 2026 — ÖZGÜN DEĞER **MALZEMEDE** SAKLANIR, mesh'te DEĞİL.
   *
   * <b>Yaşanmış hata:</b> "ürünlere bir iki kere hover olunca resimler siyaha
   * dönüşüyor."
   *
   * <b>Kök neden:</b> değer `mesh.userData`ya yazılıyordu — ama `userData`
   * JSX'te <b>tanımlı bir prop</b> (`userData={{ shelfItem, store }}`) ve R3F
   * her yeniden çizimde onu <b>yepyeni bir nesneyle değiştiriyor</b>. Doku geç
   * yüklendiğinde ya da herhangi bir state değiştiğinde saklanan değer siliniyor;
   * hedeften çıkınca `unlight` onu bulamayıp `emissive`i <b>siyaha</b> çekiyordu.
   * Raf fotoğrafı `color:#000 + emissive:#fff + emissiveMap` ile kendi kendine
   * aydınlandığı için sonuç <b>kapkara bir kutu</b> oluyordu.
   *
   * `material.userData` R3F tarafından yönetilmiyor (JSX'te tanımlı değil),
   * dolayısıyla yeniden çizimlerde hayatta kalır.
   *
   * ⚠️ Değer bilinmiyorsa <b>HİÇBİR ŞEY YAPILMAZ</b>. Eskiden siyaha
   * zorlanıyordu; "bilmiyorum" ile "siyah olmalı" aynı şey değildir ve
   * tahmin etmek tam da bu hatayı üretiyordu.
   */
  const original = m.userData.waydeeEmissive as THREE.Color | undefined
  if (!original) return
  m.emissive.copy(original)
  m.emissiveIntensity = (m.userData.waydeeEmissiveIntensity as number) ?? 1
}

/**
 * <b>Nişangâh hedeflemesi</b> — ekranın ortasındaki noktanın baktığı ürün.
 *
 * <h3>Neden gerekti?</h3>
 * <p>🔴 11 Ağu 2026, bildirilen hata: *"ortadaki nokta ürünlere gelince yeşil
 * yanma / tıklama sorunu var"*. Sebep: vurgu ve tıklama R3F'in <b>işaretçi
 * olaylarına</b> bağlıydı (`onPointerOver` / `onClick`), oysa masaüstünde
 * <b>fare kilidi</b> devrede — imleç ekranda hareket etmez, dolayısıyla
 * `pointermove` hiç gelmez ve R3F'in ışın testi <b>hiç çalışmaz</b>. FPS
 * kipinde hedef, imlecin değil <b>ekranın ortasının</b> baktığı şeydir.
 *
 * <p>Bu bileşen her karede kameranın tam merkezinden bir ışın atar, ilk
 * ürünü bulur, onu vurgular ve seçimi {@link targetRef}'e yazar. Tıklama
 * geldiğinde sayfa bu ref'i okur.
 *
 * <h3>Neden React state'i yok?</h3>
 * <p>⚠️ Vurgu, malzemenin `emissive` alanı <b>doğrudan</b> değiştirilerek yapılır. Hedefi
 * state'te tutmak, kullanıcı raflar boyunca bakarken saniyede onlarca render
 * demekti. React'e yalnız "hedef var/yok" bilgisi ({@link onAimChange}) ve
 * yalnız <b>değiştiğinde</b> ulaşır — nişangâhın rengi için o yeterli.
 */
export function Crosshair({
  targetRef,
  onAimChange,
  paused,
}: {
  /** O an nişan alınan şey (raf ürünü ya da kalp) — tıklamada sayfa bunu okur. */
  targetRef: React.RefObject<AimTarget | null>
  /** Nişangâhın altında hedeflenebilir bir şey var mı — yalnız DEĞİŞİNCE çağrılır. */
  onAimChange: (aiming: boolean) => void
  /** Kart açıkken hedefleme durur — arkada yeşil yanan bir kutu kalmasın. */
  paused: boolean
}) {
  const { camera, scene } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  /** Vurgusu açılmış mesh — geri almak için tutulur. */
  const lit = useRef<THREE.Mesh | null>(null)

  /* Bileşen sökülürken vurgu geri alınır: mağazadan çıkarken son baktığın
     kutu kalıcı olarak yeşil kalıyordu. */
  useEffect(
    () => () => {
      if (lit.current) unlight(lit.current)
      lit.current = null
    },
    [],
  )

  useFrame(() => {
    if (paused) {
      /* Duraklarken hedef TEMİZLENİR: kart kapandığında eski hedef hâlâ
         ref'te dursaydı, kapatma tıklaması aynı ürünü yeniden açardı. */
      if (lit.current) {
        unlight(lit.current)
        lit.current = null
        targetRef.current = null
        onAimChange(false)
      }
      return
    }

    /* Ekranın tam ortası: normalize cihaz koordinatlarında (0, 0). */
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera)
    raycaster.current.far = REACH

    const hits = raycaster.current.intersectObjects(scene.children, true)

    let found: THREE.Mesh | null = null
    let data: AimTarget | null = null
    for (const hit of hits) {
      const obj = hit.object as THREE.Mesh
      const ud = obj.userData as Partial<ShelfTarget> & { likeStore?: WorldStore }
      if (ud.shelfItem && ud.store) {
        found = obj
        data = { kind: 'shelf', shelfItem: ud.shelfItem, store: ud.store }
        break
      }
      /* 🔴 Kalp düğmesi (97. tur) — raf ürünüyle AYNI ışın testinde çözülür.
         ⚠️ Ürün kontrolünden SONRA gelir: ikisi üst üste denk gelseydi
         (kalp bir rafın önünde durmuyor ama sahne değişebilir) tıklamanın
         beğeniye değil ürüne gitmesi daha az şaşırtıcı olurdu. */
      if (ud.likeStore) {
        found = obj
        data = { kind: 'like', store: ud.likeStore }
        break
      }
      /*
       * ⚠️ Işın ilk KATI yüzeyde durmalı: ürünün önünde bir duvar varsa
       * onu hedefleyemezsin. Ama camlar ve ışık şeritleri katı sayılmaz —
       * vitrinin ardındaki ürüne bakarken hedef kayboluyordu.
       */
      const mat = obj.material as THREE.Material | undefined
      if (mat && !mat.transparent) break
    }

    if (found === lit.current) return

    if (lit.current) unlight(lit.current)
    if (found) {
      const m = found.material as THREE.MeshStandardMaterial
      /* ⚠️ `emissive`i olmayan malzeme (MeshBasicMaterial) vurgulanamaz —
         atlanır, yoksa `copy()` çalışma zamanında patlar. */
      if (m?.emissive) {
        /* Özgün değeri BİR KEZ sakla: raf fotoğrafı kendi kendine aydınlanıyor
           ve vurgu kalkınca o değere dönmeli, siyaha değil. */
        /* Özgün değer MALZEMEDE saklanır — `mesh.userData` R3F tarafından
           her yeniden çizimde sıfırlanıyor (gerekçe `unlight`). */
        if (m.userData.waydeeEmissive === undefined) {
          m.userData.waydeeEmissive = m.emissive.clone()
          m.userData.waydeeEmissiveIntensity = m.emissiveIntensity
        }
        m.emissive.copy(HIGHLIGHT)
        m.emissiveIntensity = 0.85
      }
    }
    lit.current = found

    targetRef.current = data
    onAimChange(!!data)
  })

  return null
}
