package com.waydee.aistudio.domain;

/**
 * Stüdyo aracının türü (V45 · 99. tur).
 *
 * <p>⚠️ Tür kolonu ilk günden vardı: ikinci araç geldiğinde yeni bir tablo ve
 * yeni bir galeri sorgusu gerekmesin diye. 99. turda karşılığını verdi —
 * {@link #EDITORIAL} ve {@link #POSE} <b>tek satır</b> enum değişikliğiyle
 * açıldı, migration gerekmedi (kolon zaten {@code varchar(30)} ve
 * {@code EnumType.STRING}).
 *
 * <p>Arayüzdeki <i>VİDEO</i> ve <i>ARAÇLAR</i> sekmeleri hâlâ "yakında".
 */
public enum AiGenerationKind {

    /** Ürün görsellerini yapay zekâ mankeni üzerinde giydirir ("Manken / Deneme"). */
    FASHION_MODEL,

    /**
     * Model ya da ürün görselini bir <b>stil referansının</b> sahnesine taşır
     * ("Editoryal / Değişim"). Girdi <b>iki</b> görseldir ve <b>sıra
     * anlamlıdır</b>: 1. görsel özne, 2. görsel sahnedir.
     */
    EDITORIAL,

    /**
     * Var olan bir sahneden <b>aynı model ve kıyafetle</b> yeni poz/açı üretir
     * ("Poz"). Girdi tek görseldir.
     *
     * <p>⚠️ Kullanıcı "3 görsel" istese bile <b>üç ayrı satır</b> yazılır —
     * vault kuralı: bir üretim = bir görsel, çünkü her görselin kendi durumu ve
     * kendi iade yolu olmalı.
     */
    POSE
}
