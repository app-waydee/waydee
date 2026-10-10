import type { LegalBundle } from '../legalContent'

/** Textos legales en español. Misma estructura que la referencia, adaptada a Waydee. */
const es: LegalBundle = {
  privacy: [
    {
      k: 'p',
      t: 'En Waydee nos comprometemos a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos tu información cuando utilizas nuestra aplicación. Léela con atención para entender nuestras prácticas respecto a tus datos personales.',
    },
    {
      k: 'p',
      t: 'Waydee («nosotros» o «nuestro») se compromete a proteger tu privacidad. Esta Política de Privacidad se aplica a nuestro sitio web y sus subdominios (conjuntamente, el «Servicio») junto con nuestra aplicación, Waydee. Al acceder o utilizar el Servicio, manifiestas que has leído y aceptas la recopilación, el almacenamiento, el uso y la divulgación de tu información personal según se describe aquí y en nuestros Términos de Servicio.',
    },

    { k: 'h2', t: 'Definiciones y términos clave' },
    {
      k: 'p',
      t: 'Para explicar las cosas con la mayor claridad posible, cada vez que se mencionen estos términos se definen así:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Cookie',
          desc: 'pequeña cantidad de datos generada por un sitio web y guardada por tu navegador. Sirve para identificar tu navegador, proporcionar analíticas y recordar información como tu preferencia de idioma o tu sesión.',
        },
        {
          term: 'Empresa',
          desc: 'cuando esta política menciona «Empresa» o «nosotros», se refiere a Waydee (Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Turquía), responsable de tu información conforme a esta política.',
        },
        { term: 'País', desc: 'donde se encuentran Waydee y sus fundadores; en este caso, Turquía.' },
        {
          term: 'Cliente',
          desc: 'la empresa, organización o persona que se registra para usar el Servicio de Waydee.',
        },
        {
          term: 'Dispositivo',
          desc: 'cualquier dispositivo conectado a internet —teléfono, tableta, ordenador— con el que se pueda visitar Waydee.',
        },
        {
          term: 'Dirección IP',
          desc: 'a cada dispositivo conectado a internet se le asigna un número. Una dirección IP puede usarse para estimar la ubicación desde la que se conecta un dispositivo.',
        },
        {
          term: 'Personal',
          desc: 'personas empleadas por Waydee o contratadas para prestar un servicio en nombre de alguna de las partes.',
        },
        {
          term: 'Datos personales',
          desc: 'cualquier información que, directa o indirectamente o en combinación con otra información —incluido un número de identificación—, permita identificar a una persona física.',
        },
        { term: 'Servicio', desc: 'el servicio prestado por Waydee tal como se describe en esta plataforma.' },
        {
          term: 'Servicio de terceros',
          desc: 'anunciantes, socios afiliados, proveedores de pago, proveedores de infraestructura, socios de marketing y otros cuyos productos o servicios puedan interesarte.',
        },
        {
          term: 'Territorio',
          desc: 'el área circular que alquilas dibujándola en el mapa. Un territorio no es propiedad, sino un <b>alquiler con plazo</b>; al vencer, se retira del mapa.',
        },
        { term: 'Sitio web', desc: 'el sitio de Waydee, accesible en: https://waydee.com' },
        { term: 'Tú', desc: 'la persona o entidad registrada en Waydee para usar los Servicios.' },
      ],
    },

    { k: 'h2', t: '¿Qué información recopilamos?' },
    {
      k: 'p',
      t: 'Recopilamos información cuando visitas nuestro sitio, te registras, compras un servicio o producto, respondes a una encuesta o rellenas un formulario.',
    },
    {
      k: 'ul',
      items: [
        'Nombre completo y nombre de usuario',
        'Dirección de correo electrónico',
        'Datos de facturación y dirección de facturación',
        'Contraseña (almacenada de forma irreversible)',
        'Foto de perfil y biografía',
        'Imágenes y vídeos compartidos en la plataforma',
        'Publicaciones, comentarios y mensajes en la plataforma',
        'Intereses y preferencias',
        'Enlaces a otros perfiles de redes sociales',
        'Enlaces a otros sitios web',
        'La ubicación y los límites del territorio que alquilas en el mapa',
        'Registros de acceso: dirección IP, país, dispositivo, navegador y sistema operativo',
      ],
    },
    {
      k: 'p',
      t: 'También recopilamos información de dispositivos móviles para mejorar la experiencia, aunque estas funciones son totalmente opcionales y la plataforma sigue funcionando si las rechazas:',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Ubicación (GPS)',
          desc: 'sirve para mostrar dónde estás en el mapa y facilitar la elección de un territorio. Si la rechazas, puedes navegar el mapa manualmente.',
        },
        {
          term: 'Cámara (imágenes)',
          desc: 'el permiso de cámara permite subir una foto directamente desde la plataforma. Puedes denegarlo sin problema.',
        },
        {
          term: 'Galería de fotos',
          desc: 'el acceso a la galería permite subir una imagen ya existente. También puedes denegarlo sin problema.',
        },
      ],
    },
    { k: 'p', t: 'Waydee no accede a tu agenda telefónica ni recopila tu lista de contactos.' },

    { k: 'h2', t: '¿Cuándo usa Waydee información de usuarios finales de terceros?' },
    {
      k: 'p',
      t: 'Waydee recopila los datos de usuario final necesarios para prestar sus servicios a los clientes. Los usuarios finales pueden facilitarnos voluntariamente información que hayan hecho pública en redes sociales. En ese caso, podemos recopilar la información públicamente disponible en los servicios que nos indiques. Puedes controlar cuánta información es pública desde los ajustes de privacidad de esas redes.',
    },

    { k: 'h2', t: '¿Cuándo usa Waydee información de clientes procedente de terceros?' },
    {
      k: 'p',
      t: 'Recibimos parte de la información de terceros cuando contactas con nosotros. Por ejemplo, al enviarnos tu correo electrónico podemos recibir información de un proveedor de detección automatizada de fraude. También recopilamos ocasionalmente información pública de redes sociales.',
    },

    { k: 'h2', t: '¿Compartimos la información con terceros?' },
    {
      k: 'p',
      t: 'Podemos compartir la información recopilada, personal y no personal, con terceros como anunciantes, socios de promoción y marketing y otros cuyos productos o servicios puedan interesarte. También podemos compartirla con empresas afiliadas actuales y futuras y, en caso de fusión, venta de activos o reorganización, transferirla a nuestros sucesores.',
    },
    {
      k: 'p',
      t: 'Contratamos proveedores de confianza para funciones como alojamiento y mantenimiento de servidores, almacenamiento y gestión de bases de datos, envío de correo, almacenamiento de medios, procesamiento de pagos y atención al cliente. Para prestar esos servicios compartimos con ellos tu información personal y, posiblemente, alguna información no personal.',
    },
    {
      k: 'p',
      t: 'Podemos compartir partes de nuestros registros, incluidas direcciones IP, con terceros con fines analíticos, como socios de analítica web, desarrolladores y redes publicitarias. Si se comparte tu dirección IP, puede usarse para estimar la ubicación general y datos técnicos como la velocidad de conexión o el tipo de dispositivo.',
    },

    { k: 'h2', t: '¿Cómo usamos la información que recopilamos?' },
    { k: 'p', t: 'La información que recopilamos puede utilizarse de las siguientes formas:' },
    {
      k: 'ul',
      items: [
        'Para personalizar tu experiencia',
        'Para mejorar nuestro sitio web',
        'Para mejorar la atención al cliente',
        'Para procesar transacciones: alquiler de territorios, renovaciones, membresía Pro y facturación',
        'Para administrar concursos, promociones, encuestas u otras funciones',
        'Para enviar correos periódicos',
        'Para detectar y prevenir el fraude',
        'Para aplicar las normas de la plataforma y moderar contenidos',
        'Para cumplir obligaciones legales',
      ],
    },

    { k: 'h2', t: '¿Cómo usamos tu dirección de correo electrónico?' },
    {
      k: 'p',
      t: 'Al enviarnos tu dirección de correo aceptas recibir correos nuestros. Puedes darte de baja en cualquier momento mediante el enlace incluido en cada mensaje. Solo escribimos a quienes nos han autorizado, directamente o a través de un tercero, y no enviamos correo comercial no solicitado. Los avisos de seguridad de la cuenta (verificación de correo, restablecimiento de contraseña, inicio de sesión sospechoso) no son mensajes de marketing y no admiten baja.',
    },

    { k: 'h2', t: '¿Cuánto tiempo conservamos tu información?' },
    {
      k: 'p',
      t: 'Conservamos tu información solo el tiempo necesario para prestarte Waydee y cumplir los fines descritos en esta política. Lo mismo se aplica a quienes prestan servicios en nuestro nombre. Cuando ya no necesitemos la información y no exista obligación legal de conservarla, la eliminaremos de nuestros sistemas o la anonimizaremos. Las facturas se conservan como registros contables durante el periodo exigido por la ley.',
    },

    { k: 'h2', t: '¿Cómo protegemos tu información?' },
    {
      k: 'p',
      t: 'Aplicamos diversas medidas de seguridad. Todo el tráfico se cifra mediante SSL/TLS. Las contraseñas se almacenan de forma irreversible; los tokens de sesión son temporales y se rotan. Los medios que subes solo son accesibles mediante enlaces firmados y con caducidad. Los datos de pago, como el número de tarjeta, nunca llegan a nuestros servidores: la página de pago pertenece al proveedor y, tras la transacción, esa información no queda registrada en nuestro sistema.',
    },

    { k: 'h2', t: '¿Puede transferirse mi información a otros países?' },
    {
      k: 'p',
      t: 'Waydee está actualmente constituida en Turquía. La información recopilada a través de nuestro sitio, de interacciones directas o del uso de nuestros servicios de ayuda puede transferirse ocasionalmente a nuestras oficinas o personal, o a terceros, situados en cualquier parte del mundo, y puede consultarse y alojarse en cualquier lugar, incluidos países que quizá no dispongan de leyes de aplicación general que regulen dichas transferencias.',
    },

    { k: 'h2', t: '¿Es segura la información recopilada a través del Servicio de Waydee?' },
    {
      k: 'p',
      t: 'Tomamos precauciones para proteger la seguridad de tu información y aplicamos medidas estrictas para impedir accesos no autorizados. Sin embargo, ni las personas ni los sistemas de seguridad —incluido el cifrado— son infalibles. Por eso, aunque hacemos esfuerzos razonables, no podemos garantizar una seguridad absoluta.',
    },

    { k: 'h2', t: '¿Puedo actualizar o corregir mi información?' },
    {
      k: 'p',
      t: 'Tus derechos para solicitar actualizaciones o correcciones dependen de tu relación con Waydee. Los clientes tienen derecho a solicitar la restricción de ciertos usos y divulgaciones de su información personal. Puedes contactarnos para (1) actualizar o corregir tu información, (2) cambiar tus preferencias de comunicación o (3) eliminar la información personal que conservamos. La mayoría de tus datos puedes editarlos directamente desde la pantalla de Ajustes.',
    },

    { k: 'h2', t: 'Ley aplicable' },
    {
      k: 'p',
      t: 'Esta Política de Privacidad se rige por las leyes de la República de Turquía, sin atender a sus normas de conflicto de leyes. Los tribunales y oficinas de ejecución de Kocaeli serán competentes para cualquier acción o disputa relacionada con esta política.',
    },

    { k: 'h2', t: 'Tu consentimiento' },
    {
      k: 'p',
      t: 'Hemos actualizado nuestra Política de Privacidad para darte total transparencia sobre lo que se establece cuando visitas nuestro sitio y cómo se usa. Al usar Waydee, registrar una cuenta o realizar una compra, aceptas esta Política de Privacidad y sus términos.',
    },

    { k: 'h2', t: 'Enlaces a otros sitios web' },
    {
      k: 'p',
      t: 'Esta política se aplica únicamente a los Servicios. Los Servicios pueden contener enlaces a sitios no operados ni controlados por Waydee, incluidos los enlaces de producto que los usuarios añaden a sus perfiles y publicaciones. No somos responsables del contenido, la exactitud ni las opiniones expresadas en dichos sitios.',
    },

    { k: 'h2', t: 'Publicidad y cookies' },
    {
      k: 'p',
      t: 'Waydee utiliza cookies para identificar las áreas de nuestro sitio que has visitado. Una cookie es un pequeño fragmento de datos que tu navegador guarda en tu dispositivo. Usamos cookies para mejorar el rendimiento y la funcionalidad del sitio, aunque no son imprescindibles para su uso.',
    },
    {
      k: 'p',
      t: 'La mayoría de navegadores permiten desactivar las cookies. Si las desactivas, es posible que no puedas acceder correctamente a algunas funciones. Nunca guardamos información que te identifique dentro de las cookies.',
    },

    { k: 'h2', t: 'Privacidad de los menores' },
    {
      k: 'p',
      t: 'No nos dirigimos a menores de 13 años ni recopilamos conscientemente información personal de ellos. Si eres madre, padre o tutor y detectas que tu hijo o hija nos ha facilitado datos personales, ponte en contacto con nosotros.',
    },

    { k: 'h2', t: '¿Qué es el contenido NSFW?' },
    {
      k: 'p',
      t: 'El contenido NSFW es todo aquel que no resulta adecuado para verse en el trabajo o para el público general. Incluye, entre otros, contenido sexual explícito, violencia gráfica, discurso de odio y otro material ofensivo.',
    },

    { k: 'h2', t: '¿Por qué nos importa el contenido NSFW?' },
    {
      k: 'p',
      t: 'Waydee es una plataforma para compartir y descubrir contenido. No admitimos la publicación de contenido NSFW. Si encuentras contenido de este tipo, comunícanoslo de inmediato. El contenido denunciado es revisado por nuestro equipo de moderación; si se confirma la infracción, se elimina y pueden aplicarse restricciones a la cuenta.',
    },

    { k: 'h2', t: 'Cambios en nuestra Política de Privacidad' },
    {
      k: 'p',
      t: 'Podemos cambiar nuestro Servicio y nuestras políticas, y puede que necesitemos modificar esta política para que refleje con precisión el Servicio. Salvo que la ley exija otra cosa, te avisaremos antes de introducir cambios y te daremos la oportunidad de revisarlos antes de que entren en vigor.',
    },

    { k: 'h2', t: 'Información sobre KVKK y RGPD' },
    {
      k: 'p',
      t: 'Podemos recopilar y usar tu información conforme a la Ley turca de Protección de Datos Personales n.º 6698 (KVKK) si te encuentras en Turquía, y conforme al Reglamento General de Protección de Datos (RGPD) si te encuentras en el Espacio Económico Europeo (EEE). En esta sección explicamos cómo y por qué se recopilan estos datos y cómo los protegemos.',
    },
    { k: 'h3', t: '¿Qué son la KVKK y el RGPD?' },
    {
      k: 'p',
      t: 'La KVKK es la ley turca que regula el tratamiento de datos personales y reconoce derechos a los interesados. El RGPD es la ley europea de protección de datos que regula cómo protegen las empresas los datos de los residentes de la UE y refuerza su control sobre ellos.',
    },
    { k: 'h3', t: 'Derechos del interesado: acceso, portabilidad y supresión' },
    {
      k: 'p',
      t: 'Nos comprometemos a ayudar a nuestros clientes a cumplir los requisitos de derechos del interesado de la KVKK y el RGPD. Waydee trata y almacena los datos personales en proveedores verificados y con acuerdo de tratamiento. Conservamos las conversaciones y los datos personales hasta 6 años, salvo que se elimine tu cuenta; en ese caso los eliminamos conforme a nuestros Términos y a esta política, sin conservarlos más de 60 días.',
    },
    {
      k: 'p',
      t: 'Tienes derecho a acceder a tus datos personales, solicitar su rectificación o supresión, limitar el tratamiento, oponerte a él y solicitar su portabilidad. Para ejercerlos, escríbenos a la dirección indicada abajo.',
    },

    { k: 'h2', t: 'Contacto' },
    { k: 'p', t: 'Si tienes preguntas sobre esta Política de Privacidad, contáctanos en:' },
    { k: 'p', t: 'Correo: info@waydee.com' },
    {
      k: 'p',
      t: 'Dirección: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Turquía',
    },
  ],

  terms: [
    { k: 'h2', t: '1. Introducción' },
    {
      k: 'p',
      t: 'Te damos la bienvenida a Waydee. Estos Términos de Servicio («Términos») rigen el uso de nuestro sitio web waydee.com y de nuestra aplicación (conjuntamente, el «Servicio»). Al acceder o utilizar el Servicio, aceptas quedar vinculado por estos Términos.',
    },

    { k: 'h2', t: '2. Cuentas' },
    {
      k: 'p',
      t: 'Al crear una cuenta debes facilitarnos información exacta, completa y actualizada en todo momento. No hacerlo constituye un incumplimiento de los Términos y puede conllevar la cancelación inmediata de tu cuenta.',
    },
    {
      k: 'p',
      t: 'Eres responsable de proteger la contraseña con la que accedes al Servicio y de toda actividad realizada con ella, tanto si la contraseña es de nuestro Servicio como de un servicio de terceros.',
    },
    {
      k: 'p',
      t: 'Te comprometes a no revelar tu contraseña a terceros. Debes avisarnos de inmediato en cuanto tengas conocimiento de cualquier brecha de seguridad o uso no autorizado de tu cuenta.',
    },
    {
      k: 'p',
      t: 'Tu dirección de correo debe estar verificada para poder alquilar un territorio o solicitar un puesto en un mercado.',
    },

    { k: 'h2', t: '3. Contenido generado por el usuario' },
    {
      k: 'p',
      t: 'Nuestro Servicio te permite publicar, enlazar, almacenar y compartir información, textos, gráficos, vídeos u otro material («Contenido»). Eres responsable del Contenido que publiques, incluida su legalidad, fiabilidad y adecuación.',
    },
    {
      k: 'p',
      t: 'Al publicar Contenido declaras y garantizas que: (i) el Contenido es tuyo o tienes derecho a usarlo y a concedernos los derechos y la licencia previstos en estos Términos, y (ii) su publicación no vulnera derechos de privacidad, de imagen, de autor, contractuales ni de ningún otro tipo de terceros.',
    },
    {
      k: 'p',
      t: 'Eres responsable de la exactitud de las etiquetas de producto y los enlaces que añades a tus publicaciones. El vendedor, el precio y las condiciones de entrega detrás de un enlace de producto no son responsabilidad de Waydee.',
    },

    { k: 'h2', t: '4. Actividades prohibidas' },
    { k: 'h3', t: 'No puedes usar el Servicio para:' },
    {
      k: 'ul',
      items: [
        'Publicar contenido ilícito, dañino, amenazante, abusivo, acosador, difamatorio, vulgar, obsceno, invasivo de la privacidad ajena, que incite al odio o que resulte objetable por motivos raciales, étnicos o de otro tipo.',
        'Suplantar a cualquier persona o entidad, incluido personal de Waydee, o declarar falsamente tu relación con una persona o entidad.',
        'Subir, publicar, enviar o poner a disposición contenido sobre el que no tengas derechos conforme a la ley o a relaciones contractuales o fiduciarias.',
        'Subir, publicar, enviar o poner a disposición publicidad no solicitada o no autorizada, material promocional, «correo basura», «spam», «cadenas de mensajes», «esquemas piramidales» o cualquier otra forma de captación.',
        'Subir, publicar, enviar o poner a disposición material que contenga virus o cualquier código informático diseñado para interrumpir, destruir o limitar la funcionalidad de software, hardware o equipos de telecomunicaciones.',
        'Intentar eludir con herramientas automatizadas las reglas de territorio, precios o solapamiento del mapa, o inundar el Servicio con peticiones automatizadas.',
      ],
    },

    { k: 'h2', t: '5. Cancelación' },
    {
      k: 'p',
      t: 'Podemos cancelar o suspender tu cuenta y bloquear el acceso al Servicio de inmediato, sin previo aviso ni responsabilidad, a nuestra entera discreción y por cualquier motivo, incluido el incumplimiento de los Términos.',
    },
    {
      k: 'p',
      t: 'Si deseas cancelar tu cuenta, puedes dejar de usar el Servicio o eliminarla desde la pantalla de Ajustes.',
    },
    {
      k: 'p',
      t: 'Todas las disposiciones de los Términos que por su naturaleza deban sobrevivir a la cancelación seguirán vigentes, incluidas, entre otras, las de propiedad, exclusión de garantías, indemnización y limitación de responsabilidad.',
    },

    { k: 'h2', t: '6. Limitación de responsabilidad' },
    {
      k: 'p',
      t: 'En ningún caso Waydee ni sus directivos, empleados, socios, agentes, proveedores o afiliados serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluida la pérdida de beneficios, datos, uso, reputación u otras pérdidas intangibles, derivados de:',
    },
    {
      k: 'ul',
      items: [
        '(i) tu uso o acceso al Servicio, o la imposibilidad de usarlo o acceder a él;',
        '(ii) la conducta o el contenido de cualquier tercero en el Servicio;',
        '(iii) cualquier contenido obtenido del Servicio; y',
        '(iv) el acceso, uso o alteración no autorizados de tus transmisiones o contenidos.',
      ],
    },
    {
      k: 'p',
      t: 'Esto se aplica con independencia de que la reclamación se base en garantía, contrato, responsabilidad extracontractual (incluida la negligencia) u otra teoría jurídica, de que se nos haya informado o no de la posibilidad de tal daño, e incluso si un remedio previsto aquí no cumple su finalidad esencial.',
    },

    { k: 'h2', t: '7. Condiciones de pago y políticas financieras' },
    {
      k: 'p',
      t: 'Waydee tiene dos productos de pago: el alquiler con plazo de un territorio en el mapa y la membresía Pro. Son independientes: la membresía Pro elimina los límites de publicación y etiquetado, mientras que la tarifa del territorio es un alquiler calculado según la superficie y la duración.',
    },
    {
      k: 'dl',
      items: [
        {
          term: 'Proveedor de pago',
          desc: 'Todos los pagos se procesan a través de un proveedor externo. Los datos de tu tarjeta nunca llegan a los servidores de Waydee.',
        },
        {
          term: 'Finalización del pago',
          desc: 'El territorio se crea solo cuando llega una notificación con firma verificada del proveedor de pago. Hasta entonces el área queda reservada temporalmente; si la reserva caduca, el área se libera.',
        },
        {
          term: 'Política de reembolsos',
          desc: 'Los reembolsos solo se tramitan en casos verificados de transacciones duplicadas, errores de la plataforma o pagos no autorizados, sujetos a revisión por la empresa.',
        },
        {
          term: 'Pagos no localizados',
          desc: 'Si crees que falta un pago, debes comunicarlo con los datos de la transacción. Lo investigaremos con el procesador de pagos antes de resolver la reclamación.',
        },
        {
          term: 'Exactitud de los datos',
          desc: 'Eres responsable de que tus datos de pago y facturación sean correctos y estén actualizados.',
        },
        {
          term: 'Pagos erróneos',
          desc: 'La empresa no se responsabiliza de los pagos realizados a cuentas incorrectas por datos inexactos facilitados por el usuario.',
        },
        {
          term: 'Pagos con retraso',
          desc: 'Los pagos pueden retrasarse por festivos bancarios, incidencias del procesador o revisiones de cumplimiento.',
        },
        {
          term: 'Cancelación de la suscripción',
          desc: 'Puedes cancelar la membresía Pro cuando quieras; la cancelación surte efecto al final del ciclo de facturación en curso, y hasta entonces las funciones Pro siguen activas.',
        },
        {
          term: 'Vencimiento del alquiler',
          desc: 'Cuando vence un territorio alquilado, se retira del mapa. Tu contenido no se elimina; puedes renovarlo para volver a publicarlo.',
        },
        {
          term: 'Obligaciones fiscales',
          desc: 'Eres el único responsable de declarar y pagar los impuestos que correspondan por tus ingresos en la plataforma.',
        },
        {
          term: 'Sin retenciones',
          desc: 'La empresa no practica retenciones fiscales por cuenta de los usuarios.',
        },
      ],
    },

    { k: 'h2', t: '8. Cambios' },
    {
      k: 'p',
      t: 'Nos reservamos el derecho, a nuestra entera discreción, de modificar o sustituir estos Términos en cualquier momento. Si la revisión es sustancial, avisaremos con al menos 30 días de antelación antes de que entren en vigor. Qué constituye un cambio sustancial se determinará a nuestra discreción.',
    },
    {
      k: 'p',
      t: 'Al seguir accediendo o usando el Servicio después de que las revisiones entren en vigor, aceptas quedar vinculado por los términos revisados. Si no los aceptas, dejas de estar autorizado a usar el Servicio.',
    },

    { k: 'h2', t: '9. Contacto' },
    { k: 'p', t: 'Si tienes preguntas sobre estos Términos, contáctanos en:' },
    { k: 'p', t: 'Correo: info@waydee.com' },
    {
      k: 'p',
      t: 'Dirección: Bilişim Vadisi, Muallimköy, Deniz Cd. No:143-5, 41400 Gebze / Kocaeli, Turquía',
    },
  ],
}

export default es
