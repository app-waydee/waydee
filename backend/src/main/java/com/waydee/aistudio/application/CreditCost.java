package com.waydee.aistudio.application;

/**
 * <b>Kredi maliyeti — tek gerçek kaynak</b> (V45).
 *
 * <h3>🔴 Neden burada, tek yerde</h3>
 * <p>Maliyet <b>yalnız sunucuda</b> hesaplanır. İstemci "bu işlem kaç kredi"
 * sorusunu <b>aynı formülü tekrar yazarak değil</b>, {@code POST /ai/quote}
 * ucuna sorarak yanıtlar. İki kopya formül olsaydı biri diğerinden sapar ve
 * kullanıcıya "60 kredi" gösterip 120 düşen bir ekran ortaya çıkardı.
 *
 * <h3>Formül</h3>
 * <pre>
 *   maliyet = temel(kalite) + (ürünSayısı - 1) × EK_URUN
 * </pre>
 *
 * <p>Gerekçeler:
 * <ul>
 *   <li><b>Kalite</b> maliyetin ana bileşeni: yüksek kalite ikinci bir
 *       sağlayıcı çağrısı (büyütme) demektir, yani bize de iki kat pahalıdır.</li>
 *   <li><b>Ürün sayısı</b> ek yük getirir: her ürün modele giden ek bir görsel,
 *       yani daha çok jeton.</li>
 * </ul>
 *
 * <p>⚠️ <b>Bir üretim = bir görsel.</b> "Kaç görsel" parametresi bilinçli olarak
 * <b>yok</b>: her görselin kendi satırı, kendi durumu ve kendi iade yolu olmalı.
 * Tek satırda dört görsel üretmek, üçü başarılı biri başarısız olduğunda ne
 * iade edileceği belirsiz bir durum yaratırdı. Dört görsel isteyen kullanıcı
 * dört kez "Oluştur" der ve dördü galeride ayrı ayrı durur.
 *
 * <p>Ölçek duygusu: Pro (2.000 kredi/ay) standart kalitede <b>33</b>, Premium
 * (10.000) <b>166</b> tekil üretim yapar. Yüksek kalitede bunun yarısı.
 */
public final class CreditCost {

    /** Standart kalite — tek sağlayıcı çağrısı (~1K çıktı). */
    public static final int BASE_STANDARD = 60;

    /** Yüksek kalite — üretim + 2× büyütme (~2K çıktı), yani iki çağrı. */
    public static final int BASE_HIGH = 120;

    /** İlkinden sonraki her ürün görseli. */
    public static final int EXTRA_PRODUCT = 10;

    /** Bir üretime konabilecek en fazla ürün (sağlayıcı da çok görselde 4'te iyi). */
    public static final int MAX_PRODUCTS = 4;


    /**
     * <b>Editoryal / Değişim</b> — özne + stil referansı, tek çıktı (99. tur).
     *
     * <p>Manken aracından pahalı olmasının sebebi somut: modele <b>iki</b>
     * görsel gidiyor ve çıktı sahne kurgusu içerdiği için yeniden deneme oranı
     * daha yüksek. Yüksek kalitede yine ikinci bir büyütme geçişi var.
     */
    public static final int EDITORIAL_STANDARD = 90;

    public static final int EDITORIAL_HIGH = 180;

    /**
     * <b>Poz</b> — varyasyon <b>başına</b> maliyet (99. tur).
     *
     * <p>🔴 "Kaç görsel" burada bir çarpandır, bir kalite ayarı değil: üç poz
     * isteyen kullanıcıya <b>üç ayrı satır</b> yazılır ve her biri bu kadar
     * krediye mal olur. Tek satırda üç görsel üretilseydi, ikisi başarılı biri
     * başarısız olduğunda ne iade edileceği belirsiz kalırdı.
     *
     * <p>⚠️ Pozda <b>kalite anahtarı yok</b>: araç var olan bir sahneyi
     * yeniden çerçeveliyor, çözünürlüğü kaynak belirliyor.
     */
    public static final int POSE_PER_IMAGE = 60;

    /** Tek istekte üretilebilecek en fazla poz varyasyonu. */
    public static final int MAX_POSE_IMAGES = 3;

    public static int editorial(boolean highQuality) {
        return highQuality ? EDITORIAL_HIGH : EDITORIAL_STANDARD;
    }

    /** @param imageCount 1..{@link #MAX_POSE_IMAGES} */
    public static int pose(int imageCount) {
        return POSE_PER_IMAGE * Math.max(1, Math.min(imageCount, MAX_POSE_IMAGES));
    }

    private CreditCost() {
    }

    /**
     * @param highQuality  2K (büyütmeli) mi
     * @param productCount 1..{@link #MAX_PRODUCTS}
     */
    public static int of(boolean highQuality, int productCount) {
        int base = highQuality ? BASE_HIGH : BASE_STANDARD;
        int products = Math.max(1, Math.min(productCount, MAX_PRODUCTS));
        return base + (products - 1) * EXTRA_PRODUCT;
    }
}
