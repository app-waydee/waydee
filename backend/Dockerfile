# ---- build aşaması ----
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace

COPY pom.xml ./
RUN mvn -q dependency:go-offline

COPY src ./src
RUN mvn -q package -DskipTests

# ---- çalışma aşaması ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S waydee && adduser -S waydee -G waydee
USER waydee

COPY --from=build /workspace/target/*.jar app.jar

# 8091 = uygulama · 8092 = yönetim/sağlık (yalnız MANAGEMENT_PORT verilirse açılır)
EXPOSE 8091 8092
# ══════════════════════════════════════════════════════════════════════
# 🔴🔴 20 Ağu 2026 — "ÜRETİMDE TÜRKÇE BOZUK" TEŞHİSİ **YANLIŞTI**
#
# Bu blok bir hatayı düzeltmek için eklendi. Sonra ölçüldü ve <b>ortada
# düzeltilecek bir hata olmadığı</b> anlaşıldı. Kayıt, aynı yanlış teşhisin
# tekrarlanmaması için duruyor.
#
# <b>Sanılan:</b> CloudWatch'ta `Trend s?ralamas? yenilendi` görüldü →
# "konteynerde stdout kodlaması ASCII" diye teşhis kondu.
#
# <b>Gerçek:</b> loglar <b>her zaman doğru UTF-8'di</b>. Bozan şey
# <b>AWS CLI'ın Windows'taki çıktı kodlamasıydı</b>: Türkçe Windows'un ANSI
# kod sayfası <b>cp1254</b> ve CLI çıktıyı ona çeviriyor.
#
# <b>Nasıl kanıtlandı:</b> CLI çıktısı dosyaya yazılıp <b>ham baytlara</b>
# bakıldı. Beklenen `?` (0x3F) değil <b>0xFD</b> çıktı — 0xFD, cp1254'te tam
# olarak `ı` harfidir. cp1254 ile çözülünce kod noktası <b>U+0131</b> ve metin
# `sıralaması` olarak <b>doğru</b> geldi.
#
# ⚠️ <b>DERS: konsol çıktısına bakıp kodlama teşhisi koyma.</b> Terminal,
# veriyle senin aranda duran bir çeviricidir. Şüphede <b>ham baytı</b> oku —
# `?` bir kodlayıcının pes ettiğini, `0xFD` gibi bir bayt ise verinin sağlam
# olup yalnız YANLIŞ OKUNDUĞUNU söyler.
#
# <b>Aşağıdaki satırlar neden duruyor:</b> zararsızlar ve açık olmak iyidir
# (JVM'in kodlamasını şansa bırakmamak). Ama bir hatayı düzeltmiyorlar —
# düzeltecek hata yoktu.
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# 🔴 Üretimde log biçimi JSON. Yerel geliştirmede bu değişken YOK, o yüzden
# okunabilir metin kalır — geliştirici konsolunda JSON hata ayıklamayı
# zorlaştırırdı.
#
# 🔴🔴 <b>`logstash`, `ecs` DEĞİL — ÖLÇÜLEREK seçildi.</b>
# İlk tercih `ecs`ti (Elastic Common Schema, daha yaygın). AWS'in kendi
# `logs test-metric-filter` ucuyla denendi ve **HİÇ EŞLEŞMEDİ**:
#
#   ecs      → {"log.level":"ERROR", ...}   desen `{ $.log.level = "ERROR" }` → 0 eşleşme
#   logstash → {"level":"ERROR", ...}       desen `{ $.level = "ERROR" }`     → 1 eşleşme
#
# <b>Sebep:</b> CloudWatch metrik filtrelerinde `$.a.b` "iç içe alan" demektir.
# ECS'in anahtar ADI düz `"log.level"` olduğu için desen onu asla bulamaz —
# ve bu SESSİZ bir başarısızlıktır: filtre kurulur, alarm kurulur, hiçbir şey
# saymaz ve kimse fark etmez.
#
# ⚠️ Ders: bir log biçimini seçmeden önce onu TÜKETECEK aracın o biçimi
# gerçekten okuyabildiğini doğrula.
ENV LOG_FORMAT=logstash

ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=75", \
  "-Dfile.encoding=UTF-8", \
  "-Dstdout.encoding=UTF-8", \
  "-Dstderr.encoding=UTF-8", \
  "-jar", "app.jar"]
