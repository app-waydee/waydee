package com.waydee.creators.domain;

/**
 * İçerik kategorileri (108. tur).
 *
 * <p>⚠️ Sabit bir liste, serbest metin değil: kategori hem filtre hem
 * sonuç etiketi olarak çevrilmiş adıyla basılıyor (beş dil). Serbest metin
 * kabul edilseydi "Moda", "moda & stil", "fashion" üç ayrı kategori olurdu.
 * Brief'teki ince ayrımlar (örn. "vegan yemek") kategoriye değil düz metne
 * yazılır ve araştırmaya oradan girer.
 */
public enum CreatorCategory {
    FASHION, BEAUTY, TECH, GAMING, FOOD, TRAVEL, FITNESS, HEALTH, PARENTING, FINANCE,
    BUSINESS, EDUCATION, MUSIC, ART, COMEDY, SPORTS, AUTO, HOME, PETS, LIFESTYLE
}
