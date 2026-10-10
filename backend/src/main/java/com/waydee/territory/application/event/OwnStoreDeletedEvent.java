package com.waydee.territory.application.event;

import java.util.UUID;

/**
 * <b>Kullanıcı kendi mağazasını sildi</b> (25 Ağu 2026, 97. tur 4. bölüm).
 *
 * <p>🔴 {@link TerritoryRemovedEvent}'ten <b>ayrı</b> bir olay: o "bir bölge
 * haritadan kalktı" der ve admin'in gizlemesi, kiranın bitmesi gibi durumlarda
 * da yayınlanır. Buradaki olay ise <b>sahibinin kendi kararıdır</b> ve
 * arkasından "artık mağazam yok" anlamına gelen temizlikler gelir (pazar
 * yerindeki stant). İkisini tek olayda toplamak, kirası biten bir kullanıcının
 * pazar başvurusunu da sessizce geri çekerdi.
 *
 * <p>⚠️ Olay {@code ownerId} taşır: dinleyen modül (pazar yeri) kullanıcının
 * stantlarını bulmak için bölge tablosuna bakmak zorunda kalmasın — modüller
 * arası doğrudan repository bağımlılığı mimarinin kuralına aykırı.
 */
public record OwnStoreDeletedEvent(UUID territoryId, UUID ownerId) {
}
