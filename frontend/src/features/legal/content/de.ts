import type { LegalBundle } from '../legalContent'

/**
 * Deutsche Rechtstexte. Gleiche Abschnittsstruktur wie die Referenz,
 * inhaltlich an Waydee angepasst.
 */
const de: LegalBundle = {
  privacy: [
    {
      k: 'p',
      t: 'Bei Waydee setzen wir uns für den Schutz Ihrer Privatsphäre ein. Diese Datenschutzerklärung erläutert, wie wir Ihre Daten erheben, verwenden, offenlegen und schützen, wenn Sie unsere Anwendung nutzen. Bitte lesen Sie diese Erklärung sorgfältig.',
    },
    {
      k: 'p',
      t: 'Waydee („wir“, „uns“ oder „unser“) verpflichtet sich zum Schutz Ihrer Privatsphäre. Diese Datenschutzerklärung gilt für unsere Website und die zugehörigen Subdomains (zusammen der „Dienst“) sowie für unsere Anwendung Waydee. Durch den Zugriff auf den Dienst oder dessen Nutzung erklären Sie sich mit der Erhebung, Speicherung, Verwendung und Offenlegung Ihrer personenbezogenen Daten einverstanden, wie in dieser Erklärung und unseren Nutzungsbedingungen beschrieben.',
    },

    { k: 'h2', t: 'Definitionen und zentrale Begriffe' },
    {
      k: 'p',
      t: 'Damit alles möglichst klar ist, werden die folgenden Begriffe in dieser Erklärung wie folgt verwendet:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Cookie',
          desc: 'kleine Datenmenge, die von einer Website erzeugt und von Ihrem Browser gespeichert wird. Sie dient dazu, Ihren Browser zu erkennen, Analysen zu ermöglichen und Angaben wie Ihre Spracheinstellung oder Anmeldedaten zu merken.',
        },
        {
          term: 'Unternehmen',
          desc: 'wenn diese Erklärung „Unternehmen“, „wir“ oder „uns“ nennt, ist Waydee gemeint (Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkei), das nach dieser Erklärung für Ihre Daten verantwortlich ist.',
        },
        { term: 'Land', desc: 'in dem Waydee bzw. die Gründer ansässig sind, in diesem Fall die Türkei.' },
        {
          term: 'Kunde',
          desc: 'das Unternehmen, die Organisation oder die Person, die sich registriert, um den Waydee-Dienst zu nutzen.',
        },
        {
          term: 'Gerät',
          desc: 'jedes mit dem Internet verbundene Gerät wie Telefon, Tablet oder Computer, mit dem Waydee besucht werden kann.',
        },
        {
          term: 'IP-Adresse',
          desc: 'jedem mit dem Internet verbundenen Gerät wird eine Nummer zugewiesen. Eine IP-Adresse kann häufig dazu genutzt werden, den ungefähren Standort einer Verbindung zu bestimmen.',
        },
        {
          term: 'Personal',
          desc: 'Personen, die bei Waydee angestellt sind oder vertraglich Leistungen für eine der Parteien erbringen.',
        },
        {
          term: 'Personenbezogene Daten',
          desc: 'alle Informationen, die direkt, indirekt oder in Verbindung mit anderen Informationen — einschließlich einer Kennnummer — die Identifizierung oder Identifizierbarkeit einer natürlichen Person ermöglichen.',
        },
        { term: 'Dienst', desc: 'die von Waydee auf dieser Plattform bereitgestellte Leistung.' },
        {
          term: 'Drittanbieterdienst',
          desc: 'Werbepartner, Zahlungsanbieter, Infrastrukturanbieter, Marketingpartner und andere, die Inhalte für uns bereitstellen oder deren Produkte für Sie interessant sein könnten.',
        },
        {
          term: 'Gebiet',
          desc: 'die kreisförmige Fläche, die Sie auf der Karte mieten. Ein Gebiet ist kein Eigentum, sondern eine <b>befristete Miete</b>; nach Ablauf wird es von der Karte entfernt.',
        },
        { term: 'Website', desc: 'die Website von Waydee, erreichbar unter: https://waydee.com' },
        { term: 'Sie', desc: 'eine bei Waydee registrierte Person oder Organisation.' },
      ],
    },

    { k: 'h2', t: 'Welche Daten erheben wir?' },
    {
      k: 'p',
      t: 'Wir erheben Daten, wenn Sie unsere Website besuchen, sich registrieren, eine Leistung erwerben, an einer Umfrage teilnehmen oder ein Formular ausfüllen.',
    },
    {
      k: 'ul',
      items: [
        'Vollständiger Name und Benutzername',
        'E-Mail-Adresse',
        'Rechnungsdaten und Rechnungsanschrift',
        'Passwort (unumkehrbar gehasht gespeichert)',
        'Profilbild und Biografie',
        'Auf der Plattform geteilte Bilder und Videos',
        'Beiträge, Kommentare und Nachrichten auf der Plattform',
        'Interessen und Präferenzen',
        'Links zu anderen Social-Media-Profilen',
        'Links zu anderen Websites',
        'Lage und Grenzen des von Ihnen gemieteten Gebiets auf der Karte',
        'Anmeldeprotokolle: IP-Adresse, Land, Gerät, Browser und Betriebssystem',
      ],
    },
    {
      k: 'p',
      t: 'Für ein besseres Nutzungserlebnis erheben wir auch Daten von Mobilgeräten. Diese Funktionen sind vollständig optional; die Plattform funktioniert auch dann, wenn Sie sie ablehnen:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Standort (GPS)',
          desc: 'zeigt Ihre Position auf der Karte und erleichtert die Auswahl eines Gebiets. Ohne Freigabe können Sie die Karte manuell bewegen.',
        },
        {
          term: 'Kamera (Bilder)',
          desc: 'die Kameraberechtigung erlaubt das Hochladen eines Bildes direkt aus der Plattform. Sie können sie gefahrlos ablehnen.',
        },
        {
          term: 'Fotogalerie (Bilder)',
          desc: 'der Zugriff auf die Galerie erlaubt das Hochladen vorhandener Bilder. Auch dieser Zugriff kann gefahrlos abgelehnt werden.',
        },
      ],
    },
    { k: 'p', t: 'Waydee greift nicht auf Ihr Telefonbuch zu und erhebt keine Kontaktlisten.' },

    { k: 'h2', t: 'Wann nutzt Waydee Endnutzerdaten von Dritten?' },
    {
      k: 'p',
      t: 'Waydee erhebt die Endnutzerdaten, die zur Erbringung der Leistungen für unsere Kunden erforderlich sind. Endnutzer können uns freiwillig Informationen zur Verfügung stellen, die sie auf Social-Media-Websites veröffentlicht haben. In diesem Fall können wir öffentlich verfügbare Informationen von den angegebenen Diensten erheben. Über die Privatsphäre-Einstellungen dieser Dienste steuern Sie, wie viel öffentlich ist.',
    },

    { k: 'h2', t: 'Wann nutzt Waydee Kundendaten von Dritten?' },
    {
      k: 'p',
      t: 'Wenn Sie uns kontaktieren, erhalten wir teilweise Informationen von Dritten. Übermitteln Sie uns beispielsweise Ihre E-Mail-Adresse, können wir Informationen von einem Dienstleister für automatisierte Betrugserkennung erhalten. Gelegentlich erheben wir zudem öffentlich verfügbare Informationen aus sozialen Netzwerken.',
    },

    { k: 'h2', t: 'Geben wir erhobene Daten an Dritte weiter?' },
    {
      k: 'p',
      t: 'Wir können die erhobenen personenbezogenen und nicht personenbezogenen Daten an Dritte weitergeben, etwa an Werbe-, Promotions- und Marketingpartner sowie an Anbieter, deren Produkte für Sie interessant sein könnten. Wir können sie auch an derzeitige und künftige verbundene Unternehmen weitergeben; bei einer Fusion, einem Verkauf von Vermögenswerten oder einer Umstrukturierung können wir Daten an unsere Rechtsnachfolger übertragen.',
    },
    {
      k: 'p',
      t: 'Wir beauftragen vertrauenswürdige Dienstleister mit Aufgaben wie Hosting und Wartung unserer Server, Datenbankspeicherung, E-Mail-Versand, Medienspeicherung, Zahlungsabwicklung und Kundenservice. Zur Erbringung dieser Leistungen geben wir personenbezogene und gegebenenfalls nicht personenbezogene Daten an diese Dritten weiter.',
    },
    {
      k: 'p',
      t: 'Teile unserer Protokolldaten, einschließlich IP-Adressen, können wir zu Analysezwecken an Dritte wie Analysepartner, Anwendungsentwickler und Werbenetzwerke weitergeben. Wird Ihre IP-Adresse geteilt, kann sie zur Schätzung des ungefähren Standorts und technischer Merkmale wie Verbindungsgeschwindigkeit oder Gerätetyp verwendet werden.',
    },

    { k: 'h2', t: 'Wie verwenden wir die erhobenen Daten?' },
    { k: 'p', t: 'Die von Ihnen erhobenen Daten können wie folgt verwendet werden:' },
    {
      k: 'ul',
      items: [
        'Um Ihr Erlebnis zu personalisieren',
        'Um unsere Website zu verbessern',
        'Um den Kundenservice zu verbessern',
        'Um Transaktionen abzuwickeln: Gebietsmiete, Verlängerung, Pro-Mitgliedschaft und Rechnungsstellung',
        'Um Gewinnspiele, Aktionen, Umfragen oder andere Funktionen durchzuführen',
        'Um regelmäßige E-Mails zu versenden',
        'Um Betrug zu erkennen und zu verhindern',
        'Um Plattformregeln durchzusetzen und Inhalte zu moderieren',
        'Um gesetzliche Pflichten zu erfüllen',
      ],
    },

    { k: 'h2', t: 'Wie verwenden wir Ihre E-Mail-Adresse?' },
    {
      k: 'p',
      t: 'Mit der Angabe Ihrer E-Mail-Adresse stimmen Sie dem Empfang von E-Mails zu. Sie können sich jederzeit über den Abmeldelink in der jeweiligen E-Mail abmelden. Wir senden nur E-Mails an Personen, die uns dazu berechtigt haben, und versenden keine unaufgeforderte Werbung. Sicherheitshinweise zum Konto (E-Mail-Bestätigung, Passwort-Zurücksetzung, verdächtige Anmeldung) sind keine Werbenachrichten und können nicht abbestellt werden.',
    },

    { k: 'h2', t: 'Wie lange speichern wir Ihre Daten?' },
    {
      k: 'p',
      t: 'Wir speichern Ihre Daten nur so lange, wie wir sie zur Bereitstellung von Waydee und zur Erfüllung der beschriebenen Zwecke benötigen. Das gilt auch für Dienstleister, die in unserem Auftrag tätig sind. Sobald wir die Daten nicht mehr benötigen und keine gesetzlichen Aufbewahrungspflichten bestehen, löschen oder anonymisieren wir sie. Rechnungen werden als Buchhaltungsunterlagen für den gesetzlich vorgeschriebenen Zeitraum aufbewahrt.',
    },

    { k: 'h2', t: 'Wie schützen wir Ihre Daten?' },
    {
      k: 'p',
      t: 'Wir setzen verschiedene Sicherheitsmaßnahmen ein. Der gesamte Datenverkehr wird per SSL/TLS verschlüsselt. Passwörter werden unumkehrbar gespeichert; Sitzungstoken sind befristet und werden rotiert. Hochgeladene Medien sind nur über signierte, ablaufende Links erreichbar. Zahlungsdaten wie Kartennummern erreichen unsere Server nie: Die Zahlungsseite gehört dem Zahlungsanbieter, und nach einer Transaktion werden diese Daten bei uns nicht gespeichert.',
    },

    { k: 'h2', t: 'Können meine Daten in andere Länder übermittelt werden?' },
    {
      k: 'p',
      t: 'Waydee ist derzeit in der Türkei ansässig. Über unsere Website, direkte Interaktionen oder Supportdienste erhobene Daten können von Zeit zu Zeit an unsere Büros, unser Personal oder an Dritte weltweit übermittelt und weltweit eingesehen und gehostet werden, auch in Ländern ohne allgemein anwendbare Gesetze zur Regelung solcher Datenübermittlungen.',
    },

    { k: 'h2', t: 'Sind die über den Waydee-Dienst erhobenen Daten sicher?' },
    {
      k: 'p',
      t: 'Wir treffen Vorkehrungen zum Schutz Ihrer Daten und haben strenge Maßnahmen gegen unbefugten Zugriff. Weder Menschen noch Sicherheitssysteme — einschließlich Verschlüsselung — sind jedoch unfehlbar. Wir bemühen uns nach vernünftigem Maß um den Schutz Ihrer Daten, können absolute Sicherheit aber nicht garantieren.',
    },

    { k: 'h2', t: 'Kann ich meine Daten aktualisieren oder berichtigen?' },
    {
      k: 'p',
      t: 'Ihre Rechte auf Aktualisierung oder Berichtigung hängen von Ihrer Beziehung zu Waydee ab. Kunden haben das Recht, die Einschränkung bestimmter Nutzungen und Offenlegungen zu verlangen. Sie können uns kontaktieren, um (1) Ihre Daten zu aktualisieren oder zu berichtigen, (2) Ihre Kommunikationspräferenzen zu ändern oder (3) die zu Ihnen gespeicherten Daten zu löschen. Die meisten Angaben können Sie direkt im Bereich Einstellungen bearbeiten.',
    },

    { k: 'h2', t: 'Anwendbares Recht' },
    {
      k: 'p',
      t: 'Diese Datenschutzerklärung unterliegt dem Recht der Republik Türkei ohne Rücksicht auf kollisionsrechtliche Bestimmungen. Für Streitigkeiten im Zusammenhang mit dieser Erklärung sind die Gerichte und Vollstreckungsbehörden von Kocaeli zuständig.',
    },

    { k: 'h2', t: 'Ihre Einwilligung' },
    {
      k: 'p',
      t: 'Wir haben unsere Datenschutzerklärung aktualisiert, um vollständige Transparenz darüber zu schaffen, was beim Besuch unserer Website gesetzt und wie es verwendet wird. Durch die Nutzung von Waydee, die Registrierung eines Kontos oder einen Kauf stimmen Sie dieser Datenschutzerklärung zu.',
    },

    { k: 'h2', t: 'Links zu anderen Websites' },
    {
      k: 'p',
      t: 'Diese Datenschutzerklärung gilt nur für die Dienste. Die Dienste können Links zu Websites enthalten, die nicht von Waydee betrieben oder kontrolliert werden — darunter Produktlinks, die Nutzer ihren Profilen und Beiträgen hinzufügen. Für Inhalte, Richtigkeit oder dort geäußerte Meinungen sind wir nicht verantwortlich.',
    },

    { k: 'h2', t: 'Werbung und Cookies' },
    {
      k: 'p',
      t: 'Waydee verwendet Cookies, um die von Ihnen besuchten Bereiche unserer Website zu erkennen. Ein Cookie ist eine kleine Datenmenge, die Ihr Browser auf Ihrem Gerät speichert. Wir nutzen Cookies, um Leistung und Funktionalität zu verbessern; für die Nutzung sind sie nicht zwingend erforderlich.',
    },
    {
      k: 'p',
      t: 'Die meisten Browser lassen sich so einstellen, dass Cookies deaktiviert werden. Deaktivieren Sie Cookies, funktionieren manche Bereiche unserer Website möglicherweise nicht richtig oder gar nicht. Wir speichern niemals personenbezogene Kennungen in Cookies.',
    },

    { k: 'h2', t: 'Datenschutz für Kinder' },
    {
      k: 'p',
      t: 'Wir richten uns nicht an Personen unter 13 Jahren und erheben wissentlich keine personenbezogenen Daten von ihnen. Wenn Sie Elternteil oder Erziehungsberechtigter sind und feststellen, dass Ihr Kind uns Daten übermittelt hat, kontaktieren Sie uns bitte.',
    },

    { k: 'h2', t: 'Was sind NSFW-Inhalte?' },
    {
      k: 'p',
      t: 'NSFW-Inhalte sind Inhalte, die nicht für die Ansicht am Arbeitsplatz oder für die Allgemeinheit geeignet sind. Dazu zählen unter anderem sexuell explizite Inhalte, grafische Gewalt, Hassrede und anderes anstößiges Material.',
    },

    { k: 'h2', t: 'Warum sind uns NSFW-Inhalte wichtig?' },
    {
      k: 'p',
      t: 'Waydee ist eine Plattform zum Teilen und Entdecken von Inhalten. Wir dulden das Teilen von NSFW-Inhalten nicht. Wenn Sie solche Inhalte finden, melden Sie sie uns bitte umgehend. Gemeldete Inhalte werden von unserem Moderationsteam geprüft; bei einem bestätigten Verstoß wird der Inhalt entfernt und das Konto kann eingeschränkt werden.',
    },

    { k: 'h2', t: 'Änderungen dieser Datenschutzerklärung' },
    {
      k: 'p',
      t: 'Wir können unseren Dienst und unsere Richtlinien ändern und müssen diese Erklärung gegebenenfalls anpassen, damit sie den Dienst korrekt widerspiegelt. Sofern gesetzlich nicht anders vorgeschrieben, informieren wir Sie vor Änderungen und geben Ihnen Gelegenheit, sie vor Inkrafttreten zu prüfen.',
    },

    { k: 'h2', t: 'Informationen zu KVKK und DSGVO' },
    {
      k: 'p',
      t: 'Wenn Sie sich in der Türkei befinden, erheben und verwenden wir Ihre Daten gegebenenfalls nach dem türkischen Datenschutzgesetz Nr. 6698 (KVKK); befinden Sie sich im Europäischen Wirtschaftsraum (EWR), nach der Datenschutz-Grundverordnung (DSGVO). In diesem Abschnitt erläutern wir, wie und warum diese Daten erhoben werden und wie wir sie schützen.',
    },
    { k: 'h3', t: 'Was sind KVKK und DSGVO?' },
    {
      k: 'p',
      t: 'KVKK ist das türkische Gesetz, das die Verarbeitung personenbezogener Daten regelt und betroffenen Personen Rechte einräumt. Die DSGVO ist ein EU-weites Datenschutzgesetz, das regelt, wie Unternehmen die Daten von EU-Bürgerinnen und -Bürgern schützen, und deren Kontrolle über ihre Daten stärkt.',
    },
    { k: 'h3', t: 'Rechte betroffener Personen — Zugang, Übertragbarkeit und Löschung' },
    {
      k: 'p',
      t: 'Wir unterstützen unsere Kunden dabei, die Betroffenenrechte nach KVKK und DSGVO zu erfüllen. Waydee verarbeitet und speichert personenbezogene Daten ausschließlich bei geprüften, AV-vertragskonformen Anbietern. Konversations- und personenbezogene Daten speichern wir bis zu 6 Jahre, sofern Ihr Konto nicht gelöscht wird; in diesem Fall löschen wir alle Daten gemäß unseren Bedingungen und dieser Erklärung, spätestens nach 60 Tagen.',
    },
    {
      k: 'p',
      t: 'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und Datenübertragbarkeit. Zur Ausübung dieser Rechte kontaktieren Sie uns unter der unten genannten Adresse.',
    },

    { k: 'h2', t: 'Kontakt' },
    { k: 'p', t: 'Bei Fragen zu dieser Datenschutzerklärung erreichen Sie uns unter:' },
    { k: 'p', t: 'E-Mail: info@waydee.com' },
    {
      k: 'p',
      t: 'Adresse: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkei',
    },
  ],

  terms: [
    { k: 'h2', t: '1. Einleitung' },
    {
      k: 'p',
      t: 'Willkommen bei Waydee. Diese Nutzungsbedingungen („Bedingungen“) regeln die Nutzung unserer Website unter waydee.com und unserer Anwendung (zusammen der „Dienst“). Mit dem Zugriff auf den Dienst oder dessen Nutzung erklären Sie sich an diese Bedingungen gebunden.',
    },

    { k: 'h2', t: '2. Konten' },
    {
      k: 'p',
      t: 'Wenn Sie ein Konto bei uns erstellen, müssen Sie jederzeit zutreffende, vollständige und aktuelle Angaben machen. Andernfalls liegt ein Verstoß gegen die Bedingungen vor, der zur sofortigen Schließung Ihres Kontos führen kann.',
    },
    {
      k: 'p',
      t: 'Sie sind für den Schutz Ihres Passworts und für alle Aktivitäten unter Ihrem Passwort verantwortlich, unabhängig davon, ob es zu unserem Dienst oder zu einem Drittanbieterdienst gehört.',
    },
    {
      k: 'p',
      t: 'Sie verpflichten sich, Ihr Passwort keinem Dritten mitzuteilen. Sobald Sie von einer Sicherheitsverletzung oder unbefugten Nutzung Ihres Kontos erfahren, müssen Sie uns unverzüglich informieren.',
    },
    {
      k: 'p',
      t: 'Ihre E-Mail-Adresse muss bestätigt sein, bevor Sie ein Gebiet mieten oder sich für einen Marktplatzstand bewerben können.',
    },

    { k: 'h2', t: '3. Nutzergenerierte Inhalte' },
    {
      k: 'p',
      t: 'Unser Dienst ermöglicht es Ihnen, bestimmte Informationen, Texte, Grafiken, Videos oder anderes Material („Inhalte“) zu veröffentlichen, zu verlinken, zu speichern und zu teilen. Für die von Ihnen veröffentlichten Inhalte — einschließlich Rechtmäßigkeit, Zuverlässigkeit und Angemessenheit — sind Sie verantwortlich.',
    },
    {
      k: 'p',
      t: 'Mit der Veröffentlichung von Inhalten sichern Sie zu, dass: (i) die Inhalte Ihnen gehören oder Sie berechtigt sind, sie zu nutzen und uns die in diesen Bedingungen vorgesehenen Rechte und Lizenzen einzuräumen, und (ii) die Veröffentlichung keine Persönlichkeits-, Urheber-, Vertrags- oder sonstigen Rechte Dritter verletzt.',
    },
    {
      k: 'p',
      t: 'Für die Richtigkeit der Produkt-Tags und Links in Ihren Beiträgen sind Sie verantwortlich. Verkäufer, Preis und Lieferbedingungen hinter einem Produktlink liegen nicht in der Verantwortung von Waydee.',
    },

    { k: 'h2', t: '4. Verbotene Aktivitäten' },
    { k: 'h3', t: 'Sie dürfen den Dienst nicht nutzen, um:' },
    {
      k: 'ul',
      items: [
        'Inhalte zu veröffentlichen, die rechtswidrig, schädlich, bedrohlich, missbräuchlich, belästigend, verleumderisch, vulgär, obszön, die Privatsphäre anderer verletzend, hasserfüllt oder in rassistischer, ethnischer oder sonstiger Hinsicht anstößig sind.',
        'sich als eine andere Person oder Organisation auszugeben, einschließlich Mitarbeitender von Waydee, oder Ihre Verbindung zu einer Person oder Organisation falsch darzustellen.',
        'Inhalte hochzuladen, zu veröffentlichen oder zu übermitteln, zu deren Bereitstellung Sie nach geltendem Recht oder aufgrund vertraglicher oder treuhänderischer Beziehungen nicht berechtigt sind.',
        'unerwünschte oder unautorisierte Werbung, Werbematerial, „Junk-Mail“, „Spam“, „Kettenbriefe“, „Schneeballsysteme“ oder andere Formen der Ansprache zu übermitteln.',
        'Material zu übermitteln, das Softwareviren oder anderen Code enthält, der die Funktionsfähigkeit von Software, Hardware oder Telekommunikationsanlagen stört, zerstört oder einschränkt.',
        'Gebiets-, Preis- oder Überschneidungsregeln der Karte mit automatisierten Werkzeugen zu umgehen oder den Dienst mit automatisierten Anfragen zu überfluten.',
      ],
    },

    { k: 'h2', t: '5. Beendigung' },
    {
      k: 'p',
      t: 'Wir können Ihr Konto nach eigenem Ermessen jederzeit ohne Vorankündigung und ohne Haftung sperren oder schließen und den Zugang zum Dienst untersagen, insbesondere bei Verstößen gegen diese Bedingungen.',
    },
    {
      k: 'p',
      t: 'Möchten Sie Ihr Konto beenden, können Sie die Nutzung einstellen oder Ihr Konto in den Einstellungen löschen.',
    },
    {
      k: 'p',
      t: 'Alle Bestimmungen dieser Bedingungen, die ihrer Natur nach eine Beendigung überdauern sollen, gelten weiter — insbesondere Eigentumsregelungen, Gewährleistungsausschlüsse, Freistellung und Haftungsbeschränkungen.',
    },

    { k: 'h2', t: '6. Haftungsbeschränkung' },
    {
      k: 'p',
      t: 'In keinem Fall haften Waydee, seine Geschäftsführung, Mitarbeitenden, Partner, Vertreter, Lieferanten oder verbundenen Unternehmen für indirekte, zufällige, besondere, Folge- oder Strafschäden, einschließlich entgangenen Gewinns, Datenverlusts, Nutzungsausfalls, Reputationsverlusts oder sonstiger immaterieller Schäden, die sich ergeben aus:',
    },
    {
      k: 'ul',
      items: [
        '(i) Ihrer Nutzung des Dienstes oder der Unmöglichkeit, ihn zu nutzen;',
        '(ii) dem Verhalten oder den Inhalten Dritter im Dienst;',
        '(iii) aus dem Dienst bezogenen Inhalten; und',
        '(iv) unbefugtem Zugriff auf oder unbefugter Änderung Ihrer Übermittlungen oder Inhalte.',
      ],
    },
    {
      k: 'p',
      t: 'Dies gilt unabhängig davon, ob die Haftung auf Gewährleistung, Vertrag, unerlaubter Handlung (einschließlich Fahrlässigkeit) oder einer anderen Rechtsgrundlage beruht, ob wir auf die Möglichkeit eines solchen Schadens hingewiesen wurden und selbst wenn ein hierin vorgesehener Rechtsbehelf seinen wesentlichen Zweck verfehlt.',
    },

    { k: 'h2', t: '7. Zahlungsbedingungen und Finanzrichtlinien' },
    {
      k: 'p',
      t: 'Waydee hat zwei kostenpflichtige Produkte: die befristete Miete eines Gebiets auf der Karte und die Pro-Mitgliedschaft. Beide sind voneinander unabhängig: Die Pro-Mitgliedschaft hebt Veröffentlichungs- und Tag-Grenzen auf, die Gebietsgebühr ist ein Mietpreis, der sich aus Fläche und Laufzeit ergibt.',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Zahlungsanbieter',
          desc: 'Alle Zahlungen werden über einen externen Zahlungsanbieter abgewickelt. Ihre Kartendaten erreichen die Server von Waydee nie.',
        },
        {
          term: 'Abschluss der Zahlung',
          desc: 'Ein Gebiet wird erst erstellt, wenn eine signaturgeprüfte Benachrichtigung des Zahlungsanbieters eintrifft. Bis dahin ist die Fläche nur vorübergehend reserviert; läuft die Reservierung ab, wird sie freigegeben.',
        },
        {
          term: 'Rückerstattungen',
          desc: 'Rückerstattungen erfolgen nur bei nachgewiesenen Doppelbuchungen, Plattformfehlern oder nicht autorisierten Zahlungen und nach Prüfung durch das Unternehmen.',
        },
        {
          term: 'Fehlende Zahlungen',
          desc: 'Wenn Sie eine Zahlung vermissen, melden Sie dies mit den betreffenden Transaktionsdaten. Wir prüfen den Vorgang gemeinsam mit dem Zahlungsdienstleister.',
        },
        {
          term: 'Richtigkeit der Angaben',
          desc: 'Sie sind dafür verantwortlich, dass Ihre Zahlungs- und Rechnungsdaten korrekt und aktuell sind.',
        },
        {
          term: 'Fehlgeleitete Zahlungen',
          desc: 'Für Zahlungen an falsche Konten aufgrund unzutreffender Nutzerangaben haftet das Unternehmen nicht.',
        },
        {
          term: 'Verspätete Zahlungen',
          desc: 'Zahlungen können sich durch Bankfeiertage, Probleme beim Zahlungsdienstleister oder Compliance-Prüfungen verzögern.',
        },
        {
          term: 'Kündigung des Abonnements',
          desc: 'Sie können die Pro-Mitgliedschaft jederzeit kündigen; die Kündigung wird zum Ende des laufenden Abrechnungszeitraums wirksam, bis dahin bleiben die Pro-Funktionen aktiv.',
        },
        {
          term: 'Ablauf der Gebietsmiete',
          desc: 'Läuft ein gemietetes Gebiet ab, wird es von der Karte entfernt. Ihre Inhalte werden nicht gelöscht; durch Verlängerung wird das Gebiet wieder sichtbar.',
        },
        {
          term: 'Steuerpflicht',
          desc: 'Für die Meldung und Zahlung anfallender Steuern auf Ihre Einkünfte über die Plattform sind ausschließlich Sie verantwortlich.',
        },
        {
          term: 'Kein Steuerabzug',
          desc: 'Das Unternehmen behält keine Steuern für Nutzer ein und führt keine ab.',
        },
      ],
    },

    { k: 'h2', t: '8. Änderungen' },
    {
      k: 'p',
      t: 'Wir behalten uns das Recht vor, diese Bedingungen jederzeit nach eigenem Ermessen zu ändern oder zu ersetzen. Bei wesentlichen Änderungen informieren wir mindestens 30 Tage vor Inkrafttreten. Was eine wesentliche Änderung darstellt, bestimmen wir nach eigenem Ermessen.',
    },
    {
      k: 'p',
      t: 'Wenn Sie den Dienst nach Inkrafttreten der Änderungen weiter nutzen, erklären Sie sich an die geänderten Bedingungen gebunden. Stimmen Sie den neuen Bedingungen nicht zu, sind Sie zur Nutzung des Dienstes nicht mehr berechtigt.',
    },

    { k: 'h2', t: '9. Kontakt' },
    { k: 'p', t: 'Bei Fragen zu diesen Bedingungen erreichen Sie uns unter:' },
    { k: 'p', t: 'E-Mail: info@waydee.com' },
    {
      k: 'p',
      t: 'Adresse: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Türkei',
    },
  ],
}

export default de
