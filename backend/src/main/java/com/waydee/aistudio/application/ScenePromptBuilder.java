package com.waydee.aistudio.application;

import com.waydee.aistudio.api.dto.AiStudioDtos.EditorialRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.PoseRequest;
import org.springframework.stereotype.Component;

/**
 * <b>Form → istem</b>, editoryal ve poz araçları için (99. tur).
 *
 * <h3>🔴 İSTEM OLUMLU DİLLE YAZILIR</h3>
 * <p>{@link FashionPromptBuilder} başındaki ölçüm burada da geçerlidir ve
 * tekrar edilmiyor: emir/olumsuzlama yoğunluğu ("do not", "EXACTLY", "strict
 * rules") modeli görsel yerine metne itiyor ve sağlayıcı <b>422
 * {@code no_media_generated}</b> döndürüyordu. Bu yüzden aşağıdaki cümleler
 * sahneyi <b>betimler</b>, kural listesi dayatmaz.
 *
 * <h3>🔴 Editoryal ile Değişim aynı istemdir</h3>
 * <p>Referans üründe kullanıcı "Editorial" ve "Swap" arasında seçim yapıyor.
 * Burada seçim <b>yok</b> ve bu bilinçli: fark, birinci görselde bir insan
 * olup olmamasıdır — yani modelin <b>gördüğü</b> bir şey. Kullanıcıya
 * sorulsaydı yanlış cevap sessizce kötü bir çıktı üretirdi. İstem iki hâli de
 * kapsayacak biçimde yazıldı ("the person or the product in the first image").
 *
 * <h3>⚠️ Stil referansı KIYAFET taşımaz</h3>
 * <p>İkinci görselden alınan şey <b>sahne, ışık, renk ve atmosferdir</b>.
 * Bunu söylememek, referanstaki modelin kıyafetinin öznenin üstüne sızmasına
 * yol açıyor — aracı işe yaramaz kılan tam olarak budur, çünkü satıcı kendi
 * ürününü göstermek için kullanıyor.
 *
 * <p>⚠️ İstem <b>İngilizcedir ve öyle kalmalı</b> (gerekçe
 * {@code FashionPromptBuilder}).
 */
@Component
public class ScenePromptBuilder {

    /**
     * Stil referansının sahnesi (1. görsel) ← özne (2. görsel).
     *
     * <h3>🔴🔴 102. TUR — SIRA TERSİNE ÇEVRİLDİ, ÇÜNKÜ MODEL 1. GÖRSELİ TUVAL SAYIYOR</h3>
     *
     * <p>Kullanıcı: <i>"hâlâ editoryal çalışmıyor, ne verdik ne çıktısı
     * veriyor"</i> — verdiği örnekte çıktı, <b>stil referansının kopyasıydı</b>.
     * 99. turda istem üç kez yeniden yazılmıştı ve sorun geçmemişti; bu turda
     * <b>gerçek sağlayıcıya yedi ölçüm çağrısı</b> yapıldı ve sebep bulundu.
     *
     * <p>🔴 <b>{@code nano-banana/edit} birinci görseli DÜZENLENEN FOTOĞRAF
     * sayar, ikinciyi zayıf bir referans olarak kullanır.</b> İstemdeki
     * "image 1 / image 2" atıfları bu eğilimi <b>yenmiyor</b>. Ölçülen tablo:
     *
     * <table>
     *   <tr><th>Gönderim sırası</th><th>Özne türü</th><th>Sonuç</th></tr>
     *   <tr><td>özne, sahne (<b>eski</b>)</td><td>insanlı, mekânlı</td>
     *       <td>❌ öznenin mekânı kaldı, sahne hiç uygulanmadı</td></tr>
     *   <tr><td>özne, sahne (<b>eski</b>)</td><td>düz zeminde ürün</td>
     *       <td>❌ tutunacak mekân olmayınca 2. görsel <b>bütünüyle</b> kopyalandı
     *           — kullanıcının bildirdiği belirti</td></tr>
     *   <tr><td>sahne, özne (<b>yeni</b>)</td><td>düz zeminde model</td>
     *       <td>✅ turuncu elbise, aynı model, aynı çanta ve sandalet, teknede</td></tr>
     *   <tr><td>sahne, özne (<b>yeni</b>)</td><td>ürün fotoğrafı</td>
     *       <td>✅ bej elbise + çanta + sandalet, Capri kayalıklarında</td></tr>
     * </table>
     *
     * <p>⚠️ <b>Tuval açıkça sabitlenmeli.</b> Yalnız sırayı çevirmek yetmedi:
     * "LOCATION — image 1:" gibi bir <b>etiketle</b> başlayan istemde model
     * bazen yine öznenin mekânına döndü. <i>"Start from the photograph in
     * image 1"</i> cümlesi eklendiğinde mekân her ölçümde doğru geldi —
     * model'e <b>hangi fotoğrafı düzenlediğini</b> söylemek, hangi rolün
     * hangisinde olduğunu söylemekten farklı bir iştir.
     *
     * <p>⚠️ Mekân <b>BOŞ</b> tarif edilir (<i>"has left the frame"</i>). Model
     * artık kimseyi "silmiyor", baştan boş bir mekân çiziyor: silme her zaman
     * artık bırakır (99. turun "sahipsiz kol"u), yeniden çizim bırakmaz.
     *
     * <p>⚠️ Uzuvlar <b>açıkça</b> sayılır (<i>"person, face, hand, arm and
     * shadow"</i>) — model için bir el, bir kişi değildir.
     *
     * <p>⚠️ <b>Sayı SÖYLENMEZ.</b> Öznede kaç kişi olduğunu bilmiyoruz.
     * 99. turda kopyalanan {@code "a single subject in the frame"} cümlesi
     * öznede iki manken varken istemle çelişiyordu ve model çelişkiyi
     * <b>ikinci görsele yaslanarak</b> çözüyordu.
     *
     * <p>🔴 <b>Editoryal ile Değişim hâlâ AYNI İSTEMDİR</b> ve ikisi de tek
     * cümleyle kapsanır: <i>"Where image 2 shows people wearing them… Where
     * image 2 shows the garments on their own…"</i>. Kullanıcıya
     * "editoryal mi değişim mi" diye sorulsaydı yanlış cevap sessizce kötü bir
     * çıktı üretirdi; fark modelin <b>gördüğü</b> bir şeydir.
     *
     * <p>⚠️ İstem <b>olumlu dille</b> yazılır (gerekçe sınıf başında) ve
     * <b>İngilizcedir</b> ({@code FashionPromptBuilder}).
     *
     * <p>🔴 <b>Sıra {@code AiStudioService.createEditorial} ile birlikte
     * değişir.</b> İstem "image 1 = mekân" diyor; girdiler oraya <b>sahne
     * önce</b> yazılıyor. İkisinden biri tek başına değiştirilirse araç sessizce
     * yine bozulur.
     */
    public String editorial(EditorialRequest request) {
        return """
                Editorial fashion photograph.

                Start from the photograph in image 1 and keep its location exactly as it is: \
                the same walls, ground, water, horizon, sky, sunlight direction, colour grade \
                and atmosphere. Anyone who was standing there has left the frame, so the place \
                is empty and open.

                Into that location, place what image 2 shows. The garments of image 2 are worn \
                in the final photograph, with the same colour, fabric, pattern, print, cut and \
                length. Where image 2 shows people wearing them, those same people appear, with \
                their own faces, hair and body proportions. Where image 2 shows the garments on \
                their own, a model wears them.

                The location, and only the location, comes from image 1. Every person, face, \
                hand, arm and shadow comes from image 2.

                They stand on that ground, lit by that sunlight, casting matching shadows. \
                Photorealistic, high-end editorial quality, natural skin texture, sharp focus \
                on the garments.
                """
                .replaceAll("[ \t]+", " ")
                .trim();
    }

    /**
     * Aynı sahneden yeni poz.
     *
     * <p>⚠️ "Aynı model, aynı kıyafet, aynı ışık" <b>her seviyede</b> yazılır;
     * değişen yalnız poz ve açının cesaretidir. Yaratıcı seviyede kimliği
     * serbest bırakmak, aracı "poz varyasyonu" olmaktan çıkarıp "başka bir
     * fotoğraf" hâline getirirdi.
     *
     * <p>🔴 <b>KAÇ KİŞİ OLDUĞU SÖYLENMEZ.</b> İlk sürümde
     * {@code "a single person in the frame"} yazıyordu — manken aracından
     * kopyalanmış, orada doğru olan bir cümle. Burada <b>kaynak sahnede iki
     * manken varsa istemle çelişiyor</b> ve model çelişkiyi kendince çözüyor
     * (aynı hata editoryalde çıktının stil referansına dönmesine yol açtı).
     * Doğrusu sayıyı hiç söylememek: "aynı kişiler" hem tek hem çok kişilik
     * sahne için doğrudur.
     */
    public String pose(PoseRequest request) {
        return """
                A fashion photograph of the same people wearing the same outfits as in the \
                attached image, captured in %s.

                The faces, the hair, the garments and the location stay recognisably the same, and \
                the bodies are fully inside the frame. Photorealistic, natural skin texture, the \
                same lighting as the source photograph.
                """
                .formatted(SceneOptions.describeCreativity(request.creativity()))
                .replaceAll("[ \t]+", " ")
                .trim();
    }

    /**
     * Poz çıktısının oranı.
     *
     * <p>🔴 Kullanıcıya <b>sorulmaz</b>: araç var olan bir sahneyi yeniden
     * çerçeveliyor ve kaynaktan farklı bir oran istemek, modelden görüntüyü
     * uydurmasını istemek demek. Manken aracının tam boy varsayılanı burada da
     * doğru varsayımdır.
     */
    public String poseAspectRatio() {
        return SceneOptions.DEFAULT_ASPECT_RATIO;
    }
}
