import type { LegalBundle } from '../legalContent'

/**
 * Türkçe yasal metinler — <b>taban dil</b>. Diğer dillerdeki bir belge
 * yüklenemezse buraya düşülür.
 *
 * <p>Yapı referansı <code>taag.app/privacy-policy</code> ve
 * <code>/terms-of-service</code>: bölüm başlıkları ve sıraları <b>birebir</b>
 * korundu, içerik Waydee'ye uyarlandı (kullanıcı: "%90'ı referanstakine uysun").
 *
 * <p>🔴 <b>Uyarlanan yerler ve NEDENİ</b> — bunlar körlemesine kopyalanamazdı:
 * <ul>
 *   <li><b>Şirket ve ülke:</b> referans Estonya/Nijerya diyor; Waydee
 *       <b>Türkiye</b>'de, Bilişim Vadisi (Gebze/Kocaeli). Yanlış yargı yetkisi
 *       yazmak sözleşmeyi uygulanamaz kılar.</li>
 *   <li><b>Uygulanacak hukuk:</b> Nijerya → <b>Türkiye</b>; ayrıca <b>KVKK</b>
 *       eklendi (referansta yalnız GDPR var — Türkiye'de faaliyet gösteren bir
 *       platform için KVKK'yı atlamak eksik bilgilendirmedir).</li>
 *   <li><b>Ödeme:</b> referans Stripe diyor, bizde <b>Polar</b> (12 Ağu 2026,
 *       LemonSqueezy'nin yerine) ve
 *       ödeme <b>imzalı webhook</b> ile tamamlanır. Ayrıca referansın
 *       "creator payout" modeli bizde yok; bizim finansal ilişkimiz
 *       <b>bölge kirası</b> ve <b>Pro üyelik</b>.</li>
 *   <li><b>Ürüne özgü kavramlar:</b> harita üzerindeki <b>bölge kirası</b>
 *       (12 aya kadar, süreli), <b>ürün etiketleri</b>, <b>koleksiyonlar</b>,
 *       <b>pazar yeri stantları</b> — referansta bunların karşılığı yok.</li>
 *   <li><b>Telefon rehberi izni</b> çıkarıldı: referansta var ama Waydee
 *       <b>rehbere hiç erişmiyor</b>. Toplamadığımız veriyi topluyormuş gibi
 *       yazmak gizlilik metninde en ağır hatadır.</li>
 * </ul>
 */
const tr: LegalBundle = {
  privacy: [
    {
      k: 'p',
      t: 'Waydee olarak gizliliğinizi korumaya kararlıyız. Bu Gizlilik Politikası, uygulamamızı kullandığınızda bilgilerinizi nasıl topladığımızı, kullandığımızı, paylaştığımızı ve koruduğumuzu açıklar. Kişisel verilerinize ilişkin görüşlerimizi ve uygulamalarımızı, verilerinizi nasıl işleyeceğimizi anlamak için lütfen bu politikayı dikkatle okuyun.',
    },
    {
      k: 'p',
      t: 'Waydee (“biz”, “bize” veya “bizim”), gizliliğinizi korumayı taahhüt eder. Bu Gizlilik Politikası, kişisel bilgilerinizin Waydee tarafından nasıl toplandığını, kullanıldığını ve açıklandığını anlatır. Politika; web sitemiz, alt alan adları ve Waydee uygulaması için (topluca “Hizmet”) geçerlidir. Hizmeti kullanarak, kişisel bilgilerinizin bu Gizlilik Politikası ve Kullanım Koşullarımızda açıklandığı şekilde toplanmasını, saklanmasını, kullanılmasını ve açıklanmasını kabul etmiş olursunuz.',
    },

    { k: 'h2', t: 'Tanımlar ve temel terimler' },
    {
      k: 'p',
      t: 'Bu politikada geçen terimler, mümkün olduğunca açık olması için aşağıdaki gibi tanımlanmıştır:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Çerez',
          desc: 'bir web sitesi tarafından üretilen ve tarayıcınız tarafından saklanan küçük veri parçası. Tarayıcınızı tanımak, analiz sağlamak ve dil tercihiniz ya da oturum bilginiz gibi bilgileri hatırlamak için kullanılır.',
        },
        {
          term: 'Şirket',
          desc: 'bu politikada “Şirket”, “biz”, “bize” veya “bizim” geçtiğinde, bu Gizlilik Politikası kapsamında bilgilerinizden sorumlu olan Waydee kastedilmektedir (Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkiye).',
        },
        {
          term: 'Ülke',
          desc: 'Waydee’nin ve kurucularının bulunduğu ülke; bu durumda Türkiye.',
        },
        {
          term: 'Müşteri',
          desc: 'ziyaretçileri ve takipçileriyle ilişkilerini yönetmek üzere Waydee Hizmetini kullanmak için kaydolan şirket, kuruluş veya kişi.',
        },
        {
          term: 'Cihaz',
          desc: 'Waydee’yi ziyaret etmek ve hizmetleri kullanmak için kullanılabilen telefon, tablet, bilgisayar gibi internete bağlı her cihaz.',
        },
        {
          term: 'IP adresi',
          desc: 'İnternete bağlı her cihaza atanan numara. Bir IP adresi, cihazın internete bağlandığı konumu yaklaşık olarak belirlemek için kullanılabilir.',
        },
        {
          term: 'Personel',
          desc: 'Waydee tarafından istihdam edilen ya da taraflardan biri adına hizmet vermek üzere sözleşmeli çalışan kişiler.',
        },
        {
          term: 'Kişisel Veri',
          desc: 'doğrudan, dolaylı olarak veya başka bilgilerle birlikte — bir kimlik numarası dâhil — gerçek bir kişinin belirlenmesini ya da belirlenebilir olmasını sağlayan her türlü bilgi.',
        },
        {
          term: 'Hizmet',
          desc: 'Waydee tarafından bu platformda ve ilgili koşullarda tarif edildiği şekilde sunulan hizmet.',
        },
        {
          term: 'Üçüncü taraf hizmeti',
          desc: 'reklam verenler, iş ortakları, ödeme sağlayıcıları, altyapı sağlayıcıları ve içeriğimizi sunan ya da ürün/hizmetlerinin ilginizi çekebileceğini düşündüğümüz diğer taraflar.',
        },
        {
          term: 'Bölge',
          desc: 'harita üzerinde çizerek kiraladığınız daire biçimli alan. Bölge bir mülkiyet değil, <b>süreli bir kiradır</b>; süresi dolduğunda haritadan iner.',
        },
        {
          term: 'Web sitesi',
          desc: 'Waydee’nin şu adresten erişilebilen sitesi: https://waydee.com',
        },
        {
          term: 'Siz',
          desc: 'Hizmetleri kullanmak üzere Waydee’ye kayıtlı olan kişi veya kuruluş.',
        },
      ],
    },

    { k: 'h2', t: 'Hangi bilgileri topluyoruz?' },
    {
      k: 'p',
      t: 'Sitemizi ziyaret ettiğinizde, kaydolduğunuzda, bir hizmet veya ürün satın aldığınızda, bir ankete yanıt verdiğinizde ya da bir formu doldurduğunuzda sizden bilgi toplarız.',
    },
    {
      k: 'ul',
      items: [
        'Ad soyad ve kullanıcı adı',
        'E-posta adresi',
        'Fatura bilgileri ve fatura adresi',
        'Şifre (geri döndürülemez biçimde şifrelenmiş olarak saklanır)',
        'Profil fotoğrafı ve biyografi',
        'Platformda paylaşılan görseller ve videolar',
        'Platformda yapılan gönderiler, yorumlar ve mesajlar',
        'İlgi alanları ve tercihler',
        'Diğer sosyal medya profillerinize bağlantılar',
        'Diğer web sitelerine bağlantılar',
        'Kiraladığınız bölgenin harita üzerindeki konumu ve sınırları',
        'Giriş kayıtları: IP adresi, ülke, cihaz, tarayıcı ve işletim sistemi bilgisi',
      ],
    },
    {
      k: 'p',
      t: 'Daha iyi bir kullanıcı deneyimi için mobil cihazlardan da bilgi toplarız; ancak bu özellikler tamamen isteğe bağlıdır ve izin vermemeniz hâlinde platform çalışmaya devam eder:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Konum (GPS)',
          desc: 'harita üzerinde bulunduğunuz yeri göstermek ve bölge seçimini kolaylaştırmak için kullanılır. İzin vermezseniz haritayı elle gezinerek kullanabilirsiniz.',
        },
        {
          term: 'Kamera (Fotoğraflar)',
          desc: 'kamera izni, doğrudan platform üzerinden fotoğraf yüklemenizi sağlar. Bu izni güvenle reddedebilirsiniz.',
        },
        {
          term: 'Fotoğraf galerisi',
          desc: 'galeri erişimi, galerinizdeki bir fotoğrafı yüklemenizi sağlar. Bu erişimi de güvenle reddedebilirsiniz.',
        },
      ],
    },
    {
      k: 'p',
      t: 'Waydee telefon rehberinize erişmez ve kişi listenizi toplamaz.',
    },

    { k: 'h2', t: 'Waydee üçüncü taraflardan son kullanıcı bilgisini ne zaman kullanır?' },
    {
      k: 'p',
      t: 'Waydee, hizmetlerini müşterilerine sunabilmek için gerekli son kullanıcı verilerini toplar. Son kullanıcılar, sosyal medya siteleri üzerinde herkese açık hâle getirdikleri bilgileri gönüllü olarak bizimle paylaşabilir. Bize böyle bir bilgi verirseniz, belirttiğiniz sosyal medya sitelerindeki herkese açık bilgileri toplayabiliriz. Bu sitelerin gizlilik ayarlarını değiştirerek bilgilerinizin ne kadarının herkese açık olacağını kontrol edebilirsiniz.',
    },

    { k: 'h2', t: 'Waydee üçüncü taraflardan müşteri bilgisini ne zaman kullanır?' },
    {
      k: 'p',
      t: 'Bizimle iletişime geçtiğinizde üçüncü taraflardan bazı bilgiler alırız. Örneğin, Waydee müşterisi olmak üzere e-posta adresinizi ilettiğinizde, otomatik sahtecilik tespiti sağlayan bir hizmet sağlayıcıdan bilgi alabiliriz. Ayrıca zaman zaman sosyal medya sitelerinde herkese açık hâle getirilen bilgileri toplayabiliriz.',
    },

    { k: 'h2', t: 'Topladığımız bilgileri üçüncü taraflarla paylaşıyor muyuz?' },
    {
      k: 'p',
      t: 'Topladığımız kişisel ve kişisel olmayan bilgileri; reklam verenler, iş ortakları, tanıtım ve pazarlama ortakları ile içeriğimizi sunan ya da ürün/hizmetlerinin ilginizi çekebileceğini düşündüğümüz diğer taraflarla paylaşabiliriz. Bu bilgileri mevcut ve gelecekteki bağlı şirketlerimiz ve iş ortaklarımızla da paylaşabiliriz; bir birleşme, varlık satışı veya yeniden yapılanma durumunda kişisel ve kişisel olmayan bilgilerinizi haleflerimize aktarabiliriz.',
    },
    {
      k: 'p',
      t: 'Sunucularımızın barındırılması ve bakımı, veri tabanı depolama ve yönetimi, e-posta gönderimi, medya depolama, ödeme işleme, müşteri desteği ve satın aldığınız hizmetlerin karşılanması gibi işlevleri yerine getirmek üzere güvenilir üçüncü taraf hizmet sağlayıcılarla çalışırız. Bu hizmetleri bizim ve sizin için yerine getirebilmeleri amacıyla kişisel bilgilerinizi ve muhtemelen bazı kişisel olmayan bilgileri bu taraflarla paylaşırız.',
    },
    {
      k: 'p',
      t: 'IP adresleri dâhil günlük kayıtlarımızın bir kısmını analiz amacıyla web analitiği ortakları, uygulama geliştiricileri ve reklam ağları gibi üçüncü taraflarla paylaşabiliriz. IP adresiniz paylaşılırsa, genel konum ve bağlantı hızı, siteyi ortak bir konumdan ziyaret edip etmediğiniz ve kullandığınız cihaz türü gibi teknik bilgileri tahmin etmek için kullanılabilir.',
    },

    { k: 'h2', t: 'Topladığımız bilgileri nasıl kullanıyoruz?' },
    {
      k: 'p',
      t: 'Sizden topladığımız bilgiler aşağıdaki amaçlarla kullanılabilir:',
    },
    {
      k: 'ul',
      items: [
        'Deneyiminizi kişiselleştirmek (bilgileriniz bireysel ihtiyaçlarınıza daha iyi yanıt vermemizi sağlar)',
        'Web sitemizi geliştirmek (aldığımız bilgi ve geri bildirimlere göre sunduklarımızı sürekli iyileştiririz)',
        'Müşteri hizmetlerini geliştirmek (destek taleplerinize daha etkili yanıt vermemizi sağlar)',
        'İşlemleri gerçekleştirmek: bölge kiralama, yenileme, Pro üyelik ve faturalandırma',
        'Bir yarışma, promosyon, anket veya başka bir site özelliğini yürütmek',
        'Dönemsel e-postalar göndermek',
        'Sahteciliği tespit etmek ve önlemek',
        'Platform kurallarını uygulamak ve içerik moderasyonu yapmak',
        'Yasal yükümlülüklere uymak',
      ],
    },

    { k: 'h2', t: 'E-posta adresinizi nasıl kullanıyoruz?' },
    {
      k: 'p',
      t: 'Bu sitede e-posta adresinizi ileterek bizden e-posta almayı kabul etmiş olursunuz. İlgili e-postalarda yer alan abonelikten çıkma bağlantısına tıklayarak bu listelerden istediğiniz zaman çıkabilirsiniz. Yalnızca doğrudan ya da bir üçüncü taraf aracılığıyla bizimle iletişime geçilmesine izin veren kişilere e-posta göndeririz; istenmeyen ticari e-posta göndermeyiz. Hesap güvenliğine ilişkin bildirimler (e-posta doğrulama, şifre sıfırlama, şüpheli giriş) pazarlama iletisi değildir ve bunlardan çıkılamaz.',
    },

    { k: 'h2', t: 'Bilgilerinizi ne kadar süre saklıyoruz?' },
    {
      k: 'p',
      t: 'Bilgilerinizi yalnızca Waydee’yi size sunmak ve bu politikada açıklanan amaçları yerine getirmek için ihtiyaç duyduğumuz süre boyunca saklarız. Bu, bilgilerinizi paylaştığımız ve bizim adımıza hizmet yürüten taraflar için de geçerlidir. Bilgilerinizi kullanmamıza gerek kalmadığında ve yasal ya da düzenleyici yükümlülüklerimiz için saklamamız gerekmediğinde, bilgileri sistemlerimizden sileriz veya sizi tanımlayamayacağımız şekilde anonimleştiririz. Faturalar, muhasebe kayıtları olarak mevzuatın öngördüğü süre boyunca saklanır.',
    },

    { k: 'h2', t: 'Bilgilerinizi nasıl koruyoruz?' },
    {
      k: 'p',
      t: 'Bir hizmet satın aldığınızda ya da kişisel bilgilerinizi girdiğinizde, gönderdiğinizde veya bunlara eriştiğinizde güvenliğini sağlamak için çeşitli önlemler uygularız. Tüm trafik SSL/TLS ile şifrelenir. Şifreler geri döndürülemez biçimde saklanır; oturum jetonları süreli ve döndürülmelidir. Yüklediğiniz medyaya yalnızca imzalı ve süreli bağlantılarla erişilebilir. Ödeme bilgileri (kart numarası gibi) hiçbir zaman sunucularımıza ulaşmaz; ödeme sayfası ödeme sağlayıcısına aittir ve işlem sonrası bu bilgiler tarafımızda tutulmaz.',
    },

    { k: 'h2', t: 'Bilgilerim başka ülkelere aktarılabilir mi?' },
    {
      k: 'p',
      t: 'Waydee hâlihazırda Türkiye’de faaliyet göstermektedir. Web sitemiz aracılığıyla, sizinle doğrudan etkileşimlerle ya da destek hizmetlerinin kullanımıyla toplanan bilgiler, zaman zaman dünyanın farklı yerlerindeki ofislerimize, personelimize veya üçüncü taraflara aktarılabilir ve bu verilerin kullanımını ve aktarımını düzenleyen genel geçer yasaları bulunmayan ülkeler de dâhil olmak üzere dünyanın herhangi bir yerinde görüntülenebilir ve barındırılabilir.',
    },

    { k: 'h2', t: 'Waydee Hizmeti üzerinden toplanan bilgiler güvende mi?' },
    {
      k: 'p',
      t: 'Bilgilerinizin güvenliğini korumak için önlemler alıyoruz. Yetkisiz erişimi engellemek, veri güvenliğini sürdürmek ve bilgilerinizi doğru şekilde kullanmak için sıkı tedbirlerimiz var. Ancak ne insanlar ne de güvenlik sistemleri — şifreleme sistemleri dâhil — kusursuzdur. Bu nedenle, kişisel bilgilerinizi korumak için makul çabayı gösteriyor olsak da mutlak güvenliği garanti edemeyiz.',
    },

    { k: 'h2', t: 'Bilgilerimi güncelleyebilir veya düzeltebilir miyim?' },
    {
      k: 'p',
      t: 'Waydee’nin topladığı bilgilerde güncelleme veya düzeltme talep etme haklarınız, Waydee ile ilişkinize bağlıdır. Kullanıcılar, kişisel bilgilerinin belirli kullanım ve açıklamalarının kısıtlanmasını talep etme hakkına sahiptir. (1) Kişisel bilgilerinizi güncellemek veya düzeltmek, (2) bizden aldığınız iletişim ve bilgilere ilişkin tercihlerinizi değiştirmek ya da (3) sistemlerimizde tutulan kişisel bilgilerinizi silmek için bizimle iletişime geçebilirsiniz. Bilgilerinizin çoğunu Ayarlar ekranından doğrudan kendiniz düzenleyebilirsiniz.',
    },

    { k: 'h2', t: 'Uygulanacak hukuk' },
    {
      k: 'p',
      t: 'Bu Gizlilik Politikası, kanunlar ihtilafı hükümlerine bakılmaksızın Türkiye Cumhuriyeti kanunlarına tabidir. Bu Gizlilik Politikası kapsamında veya bununla bağlantılı olarak taraflar arasında doğacak her türlü uyuşmazlıkta Kocaeli mahkemeleri ve icra daireleri yetkilidir.',
    },

    { k: 'h2', t: 'Onayınız' },
    {
      k: 'p',
      t: 'Sitemizi ziyaret ettiğinizde nelerin toplandığı ve nasıl kullanıldığı konusunda size tam şeffaflık sağlamak için Gizlilik Politikamızı güncelledik. Waydee’yi kullanarak, bir hesap oluşturarak veya bir satın alma işlemi yaparak bu Gizlilik Politikasını ve koşullarını kabul etmiş olursunuz.',
    },

    { k: 'h2', t: 'Diğer web sitelerine bağlantılar' },
    {
      k: 'p',
      t: 'Bu Gizlilik Politikası yalnızca Hizmetler için geçerlidir. Hizmetler, Waydee tarafından işletilmeyen veya denetlenmeyen başka web sitelerine bağlantılar içerebilir — kullanıcıların profillerine ve gönderilerine ekledikleri ürün bağlantıları dâhil. Bu sitelerin içeriğinden, doğruluğundan veya orada ifade edilen görüşlerden sorumlu değiliz; bu siteler tarafımızca incelenmez, izlenmez veya doğruluk açısından denetlenmez.',
    },

    { k: 'h2', t: 'Reklam ve çerezler' },
    {
      k: 'p',
      t: 'Waydee, sitemizin ziyaret ettiğiniz bölümlerini tanımak için “Çerezler” kullanır. Çerez, tarayıcınız tarafından bilgisayarınıza veya mobil cihazınıza kaydedilen küçük bir veri parçasıdır. Çerezleri sitemizin performansını ve işlevselliğini artırmak için kullanırız; ancak bunlar sitenin kullanımı için zorunlu değildir.',
    },
    {
      k: 'p',
      t: 'Çoğu web tarayıcısı, çerez kullanımını devre dışı bırakacak şekilde ayarlanabilir. Ancak çerezleri devre dışı bırakırsanız sitemizdeki işlevlere doğru şekilde ya da hiç erişemeyebilirsiniz. Çerezlerin içine hiçbir zaman kimliğinizi belirleyen bilgi koymayız.',
    },

    { k: 'h2', t: 'Çocukların gizliliği' },
    {
      k: 'p',
      t: '13 yaşın altındaki hiç kimseye hitap etmiyoruz. 13 yaşın altındaki kişilerden bilerek kişisel bilgi toplamayız. Ebeveyn veya vasi iseniz ve çocuğunuzun bize kişisel veri sağladığını fark ederseniz lütfen bizimle iletişime geçin.',
    },

    { k: 'h2', t: 'NSFW içerik nedir?' },
    {
      k: 'p',
      t: 'NSFW içerik, iş yerinde görüntülenmeye veya genel olarak herkese açık paylaşılmaya uygun olmayan her türlü içeriği ifade eder. Buna cinsel içerikli materyal, şiddet içeren görüntüler, nefret söylemi ve diğer rahatsız edici materyaller dâhildir; ancak bunlarla sınırlı değildir.',
    },

    { k: 'h2', t: 'NSFW içeriği neden önemsiyoruz?' },
    {
      k: 'p',
      t: 'Waydee, içerik paylaşma ve keşfetme platformudur. NSFW içeriğin paylaşılmasını onaylamıyoruz. Platformumuzda böyle bir içerikle karşılaşırsanız lütfen derhal bize bildirin. Bildirilen içerik moderasyon ekibimizce incelenir; kural ihlali tespit edilirse içerik kaldırılır ve hesaba kısıtlama uygulanabilir.',
    },

    { k: 'h2', t: 'Gizlilik Politikamızdaki değişiklikler' },
    {
      k: 'p',
      t: 'Hizmetimizi ve politikalarımızı değiştirebiliriz; bu Gizlilik Politikasının hizmet ve politikalarımızı doğru yansıtması için değişiklik yapmamız gerekebilir. Yasa aksini gerektirmedikçe, bu Gizlilik Politikasında değişiklik yapmadan önce sizi bilgilendirir ve değişiklikler yürürlüğe girmeden önce gözden geçirmeniz için fırsat veririz.',
    },

    { k: 'h2', t: 'KVKK ve GDPR hakkında bilgi' },
    {
      k: 'p',
      t: 'Türkiye’de bulunuyorsanız 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK), Avrupa Ekonomik Alanı’nda (AEA) bulunuyorsanız Genel Veri Koruma Tüzüğü (GDPR) kapsamında bilgilerinizi topluyor ve kullanıyor olabiliriz. Bu bölümde bu verilerin tam olarak nasıl ve neden toplandığını, kopyalanmaya veya yanlış kullanılmaya karşı nasıl koruduğumuzu açıklıyoruz.',
    },
    { k: 'h3', t: 'KVKK ve GDPR nedir?' },
    {
      k: 'p',
      t: 'KVKK, Türkiye’de kişisel verilerin işlenmesini düzenleyen ve veri sahibine haklar tanıyan kanundur. GDPR ise AB genelinde geçerli olan, AB’de yaşayanların verilerinin şirketler tarafından nasıl korunacağını düzenleyen ve kişilerin kendi verileri üzerindeki kontrolünü güçlendiren bir veri koruma yasasıdır.',
    },
    { k: 'h3', t: 'Veri sahibinin hakları — erişim, taşınabilirlik ve silme' },
    {
      k: 'p',
      t: 'Kullanıcılarımızın KVKK ve GDPR kapsamındaki veri sahibi haklarını karşılamalarına yardımcı olmaya kararlıyız. Waydee, tüm kişisel verileri incelenmiş ve veri işleme sözleşmesine uygun tedarikçilerde işler veya saklar. Hesabınız silinmediği sürece tüm yazışma ve kişisel verileri en fazla 6 yıl saklarız; hesap silindiğinde verileri Kullanım Koşulları ve bu Gizlilik Politikası uyarınca imha ederiz ve 60 günden uzun süre tutmayız.',
    },
    {
      k: 'p',
      t: 'Kişisel verilerinize erişme, düzeltilmesini veya silinmesini isteme, işlenmesini kısıtlama, işlemeye itiraz etme ve verilerinizin taşınabilirliğini talep etme haklarına sahipsiniz. Bu haklarınızı kullanmak için aşağıdaki adresten bize ulaşabilirsiniz.',
    },

    { k: 'h2', t: 'Bize ulaşın' },
    {
      k: 'p',
      t: 'Bu Gizlilik Politikası hakkında sorularınız varsa bizimle iletişime geçin:',
    },
    {
      k: 'p',
      t: 'E-posta: info@waydee.com',
    },
    {
      k: 'p',
      t: 'Adres: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkiye',
    },
  ],

  terms: [
    { k: 'h2', t: '1. Giriş' },
    {
      k: 'p',
      t: 'Waydee’ye hoş geldiniz. Bu Kullanım Koşulları (“Koşullar”), waydee.com adresinde bulunan web sitemizin ve uygulamamızın (topluca “Hizmet”) kullanımını düzenler. Hizmete erişerek veya Hizmeti kullanarak bu Koşullarla bağlı olmayı kabul edersiniz.',
    },

    { k: 'h2', t: '2. Hesaplar' },
    {
      k: 'p',
      t: 'Bizde bir hesap oluşturduğunuzda, her zaman doğru, eksiksiz ve güncel bilgi vermeniz gerekir. Bunu yapmamanız Koşulların ihlali sayılır ve Hizmetteki hesabınızın derhal kapatılmasıyla sonuçlanabilir.',
    },
    {
      k: 'p',
      t: 'Hizmete erişmek için kullandığınız şifreyi korumaktan ve şifrenizle gerçekleştirilen tüm etkinlik ve işlemlerden — şifre ister bizim Hizmetimize ister üçüncü taraf bir hizmete ait olsun — siz sorumlusunuz.',
    },
    {
      k: 'p',
      t: 'Şifrenizi hiçbir üçüncü tarafa açıklamamayı kabul edersiniz. Herhangi bir güvenlik ihlalinden veya hesabınızın yetkisiz kullanımından haberdar olduğunuz anda derhal bize bildirmelisiniz.',
    },
    {
      k: 'p',
      t: 'Bölge kiralamak ve pazar yeri standı başvurusu yapmak için e-posta adresinizin doğrulanmış olması gerekir.',
    },

    { k: 'h2', t: '3. Kullanıcı tarafından oluşturulan içerik' },
    {
      k: 'p',
      t: 'Hizmetimiz; belirli bilgileri, metinleri, grafikleri, videoları veya diğer materyalleri (“İçerik”) yayınlamanıza, bağlamanıza, saklamanıza, paylaşmanıza ve başka şekillerde kullanıma sunmanıza olanak tanır. Hizmet üzerinde veya Hizmet aracılığıyla yayınladığınız İçerikten — yasallığı, güvenilirliği ve uygunluğu dâhil — siz sorumlusunuz.',
    },
    {
      k: 'p',
      t: 'İçeriği Hizmet üzerinde veya Hizmet aracılığıyla yayınlayarak şunları beyan ve taahhüt edersiniz: (i) İçerik size aittir (sahibi sizsiniz) ya da onu kullanma ve bu Koşullarda öngörülen hakları ve lisansı bize verme hakkına sahipsiniz ve (ii) İçeriğinizin Hizmet üzerinde veya Hizmet aracılığıyla yayınlanması herhangi bir kişinin gizlilik haklarını, kişilik haklarını, telif haklarını, sözleşme haklarını veya diğer haklarını ihlal etmez.',
    },
    {
      k: 'p',
      t: 'Gönderilerinize eklediğiniz ürün etiketlerinin ve bağlantıların doğruluğundan siz sorumlusunuz. Bir ürün bağlantısının işaret ettiği satıcı, fiyat ve teslimat koşulları Waydee’nin sorumluluğunda değildir.',
    },

    { k: 'h2', t: '4. Yasaklı faaliyetler' },
    { k: 'h3', t: 'Hizmeti şunlar için kullanamazsınız:' },
    {
      k: 'ul',
      items: [
        'Hukuka aykırı, zararlı, tehditkâr, kötüye kullanıcı, taciz edici, iftira niteliğinde, kaba, müstehcen, başkasının özel hayatını ihlal eden, nefret içeren ya da ırksal, etnik veya başka şekilde sakıncalı içerik yayınlamak.',
        'Bir Waydee çalışanı dâhil olmak üzere herhangi bir kişi veya kuruluşun kimliğine bürünmek ya da bir kişi veya kuruluşla olan ilişkinizi yanlış beyan etmek.',
        'Herhangi bir yasa uyarınca veya sözleşmeye dayalı ya da güvene dayalı ilişkiler kapsamında kullanıma sunma hakkına sahip olmadığınız içeriği yüklemek, yayınlamak, e-postayla göndermek veya başka şekilde kullanıma sunmak.',
        'İstenmeyen veya izinsiz reklam, tanıtım materyali, “önemsiz posta”, “spam”, “zincir mektup”, “saadet zinciri” ya da başka bir talep biçimini yüklemek, yayınlamak, e-postayla göndermek veya başka şekilde kullanıma sunmak.',
        'Herhangi bir bilgisayar yazılımının, donanımının veya telekomünikasyon ekipmanının işlevselliğini kesintiye uğratmak, yok etmek veya sınırlamak üzere tasarlanmış yazılım virüsleri ya da başka bilgisayar kodu, dosya veya program içeren materyal yüklemek, yayınlamak, e-postayla göndermek veya başka şekilde kullanıma sunmak.',
        'Haritadaki bölge, fiyatlandırma veya çakışma kurallarını otomatik araçlarla dolanmaya çalışmak ya da Hizmete otomatik istek yağdırmak.',
      ],
    },

    { k: 'h2', t: '5. Fesih' },
    {
      k: 'p',
      t: 'Koşulların ihlali dâhil ancak bununla sınırlı olmamak üzere, herhangi bir nedenle ve sınırlama olmaksızın, kendi takdirimize bağlı olarak, önceden bildirimde bulunmaksızın ve sorumluluk üstlenmeksizin hesabınızı kapatabilir veya askıya alabilir ve Hizmete erişimi engelleyebiliriz.',
    },
    {
      k: 'p',
      t: 'Hesabınızı kapatmak isterseniz Hizmeti kullanmayı bırakabilir ya da Ayarlar ekranından hesabınızı silebilirsiniz.',
    },
    {
      k: 'p',
      t: 'Koşulların, niteliği gereği fesihten sonra da yürürlükte kalması gereken tüm hükümleri — mülkiyet hükümleri, garanti reddi, tazminat ve sorumluluk sınırlamaları dâhil ancak bunlarla sınırlı olmamak üzere — fesihten sonra da geçerliliğini korur.',
    },

    { k: 'h2', t: '6. Sorumluluğun sınırlandırılması' },
    {
      k: 'p',
      t: 'Hiçbir durumda Waydee ya da yöneticileri, çalışanları, ortakları, temsilcileri, tedarikçileri veya bağlı kuruluşları; kâr, veri, kullanım, itibar veya diğer maddi olmayan kayıplar dâhil ancak bunlarla sınırlı olmamak üzere, dolaylı, arızi, özel, sonuç niteliğinde veya cezai zararlardan sorumlu tutulamaz. Bu, aşağıdakilerden kaynaklanan zararlar için geçerlidir:',
    },
    {
      k: 'ul',
      items: [
        '(i) Hizmete erişiminiz, Hizmeti kullanmanız ya da Hizmete erişememeniz veya Hizmeti kullanamamanız;',
        '(ii) Hizmetteki herhangi bir üçüncü tarafın davranışı veya içeriği;',
        '(iii) Hizmetten elde edilen herhangi bir içerik;',
        '(iv) iletimlerinize veya içeriğinize yetkisiz erişim, bunların yetkisiz kullanımı ya da değiştirilmesi.',
      ],
    },
    {
      k: 'p',
      t: 'Bu sınırlama; garanti, sözleşme, haksız fiil (ihmal dâhil) veya başka bir hukuki temele dayanıp dayanmadığına, böyle bir zarar olasılığından haberdar edilip edilmediğimize ve burada öngörülen bir çözümün asli amacını gerçekleştirmediğinin tespit edilip edilmediğine bakılmaksızın geçerlidir.',
    },

    { k: 'h2', t: '7. Ödeme koşulları ve finansal politikalar' },
    {
      k: 'p',
      t: 'Waydee’de iki ücretli ürün vardır: harita üzerindeki bölgenin süreli kirası ve Pro üyelik. Bunlar birbirinden bağımsızdır; Pro üyeliği paylaşım ve etiket sınırlarını kaldırır, bölge ücreti ise alanın büyüklüğüne ve süresine göre hesaplanan bir kira bedelidir.',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Ödeme sağlayıcısı',
          desc: 'Tüm ödemeler harici bir ödeme sağlayıcısı üzerinden işlenir. Kart bilgileriniz hiçbir zaman Waydee sunucularına ulaşmaz.',
        },
        {
          term: 'Ödemenin tamamlanması',
          desc: 'Bölge, ancak ödeme sağlayıcısından imzası doğrulanmış bir bildirim geldiğinde oluşturulur. Ödeme tamamlanmadan alan yalnızca geçici olarak rezerve edilir; süresi dolarsa alan serbest kalır.',
        },
        {
          term: 'İade politikası',
          desc: 'İadeler yalnızca doğrulanmış mükerrer işlem, platform hatası veya yetkisiz ödeme durumlarında, incelemeye tabi olarak yapılabilir.',
        },
        {
          term: 'Eksik ödemeler',
          desc: 'Bir ödemenin veya yansımanın eksik olduğunu düşünüyorsanız, ilgili işlem bilgileriyle birlikte bize bildirmeniz gerekir. Talebi sonuçlandırmadan önce ödeme sağlayıcısıyla birlikte inceleriz.',
        },
        {
          term: 'Bilgi doğruluğu',
          desc: 'Ödeme ve fatura bilgilerinizin doğru ve güncel olmasını sağlamak sizin sorumluluğunuzdadır.',
        },
        {
          term: 'Yanlış ödemeler',
          desc: 'Kullanıcının hatalı bilgi vermesi nedeniyle yanlış hesaplara yapılan ödemelerden şirket sorumlu değildir.',
        },
        {
          term: 'Geciken ödemeler',
          desc: 'Banka tatilleri, ödeme sağlayıcısı kaynaklı sorunlar veya uyum incelemeleri nedeniyle ödemeler gecikebilir.',
        },
        {
          term: 'Aboneliğin iptali',
          desc: 'Pro üyeliğinizi istediğiniz zaman iptal edebilirsiniz; iptal, aksi belirtilmedikçe mevcut fatura döneminin sonunda yürürlüğe girer ve dönem sonuna kadar Pro özellikleri açık kalır.',
        },
        {
          term: 'Bölge kirasının sona ermesi',
          desc: 'Kiralanan bölgenin süresi dolduğunda bölge haritadan iner. İçeriğiniz silinmez; bölgeyi yenileyerek yeniden yayına alabilirsiniz.',
        },
        {
          term: 'Vergi yükümlülüğü',
          desc: 'Platform üzerinden elde ettiğiniz kazançlardan doğan vergilerin beyanı ve ödenmesi münhasıran size aittir.',
        },
        {
          term: 'Stopaj yok',
          desc: 'Şirket, kullanıcılar adına vergi kesintisi veya stopaj yapmaz.',
        },
      ],
    },

    { k: 'h2', t: '8. Değişiklikler' },
    {
      k: 'p',
      t: 'Bu Koşulları herhangi bir zamanda, kendi takdirimize bağlı olarak değiştirme veya yenisiyle değiştirme hakkını saklı tutarız. Bir değişiklik esaslı ise, yeni koşullar yürürlüğe girmeden önce en az 30 gün önceden bildirimde bulunuruz. Neyin esaslı bir değişiklik olduğu kendi takdirimizle belirlenir.',
    },
    {
      k: 'p',
      t: 'Değişiklikler yürürlüğe girdikten sonra Hizmete erişmeye veya Hizmeti kullanmaya devam ederek revize edilmiş koşullarla bağlı olmayı kabul edersiniz. Yeni koşulları kabul etmiyorsanız Hizmeti kullanma yetkiniz sona erer.',
    },

    { k: 'h2', t: '9. Bize ulaşın' },
    {
      k: 'p',
      t: 'Bu Koşullar hakkında sorularınız varsa bizimle iletişime geçin:',
    },
    {
      k: 'p',
      t: 'E-posta: info@waydee.com',
    },
    {
      k: 'p',
      t: 'Adres: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkiye',
    },
  ],
}

export default tr
