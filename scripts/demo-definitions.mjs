export const DEMO_BASE_ISO = "2026-07-01T12:00:00.000Z";
export const DEMO_PASSWORD = "KaklenDemo2026!";

export const DEMO_ORGANIZATIONS = [
  {
    key: "angela",
    codePrefix: "ANG",
    profile: "Empresa eventos",
    accountName: "Ángela Producciones Demo",
    email: "empresa.angela@demo.kaklen.local",
    firstName: "Ángela",
    lastName: "Producciones Demo",
    organizationName: "Ángela Producciones Demo SpA",
    legalName: "Ángela Producciones Demo SpA",
    organizationType: "LEGAL_ENTITY",
    slug: "demo-angela-producciones",
    rutBody: "76111001",
    clients: [
      company("Colegio Bicentenario Los Aromos", "Colegio Los Aromos", "Puente Alto", "Producción de graduación anual para la comunidad escolar."),
      person("Valentina", "Ríos", "Providencia", "Matrimonio con ceremonia y recepción en un mismo recinto."),
      company("Centro de Eventos Vista Cordillera SpA", "Vista Cordillera", "Las Condes", "Centro asociado para producciones corporativas y matrimonios."),
      person("Nicolás", "Fuentes", "Maipú", "Representante de curso para celebración de graduación."),
      company("Asociación Comercial Emprende Chile", "Asociación Comercial Emprende Chile", "Santiago", "Encuentros de networking y premiaciones para asociados."),
      person("Camila", "Torres", "Ñuñoa", "Celebración familiar con ambientación y catering."),
      company("Colegio San Gabriel del Valle", "Colegio San Gabriel", "La Florida", "Licenciaturas y actividades de aniversario escolar."),
      person("Matías", "Andrade", "La Reina", "Fiesta de graduación con producción audiovisual."),
      company("Centro Cultural La Estación Ltda.", "La Estación", "Estación Central", "Programación de ferias, festivales y encuentros comunitarios."),
      person("Fernanda", "Lagos", "Vitacura", "Aniversario privado con coordinación integral.")
    ],
    catalog: [
      product("TRUSS", "Estructura truss modular", "Tramos certificados para escenarios y soportes de iluminación.", "tramo", "65000", "110000"),
      product("LED-P3", "Pantalla LED P3", "Módulo de alta resolución para contenido corporativo y celebraciones.", "m2", "120000", "210000"),
      product("SILLA-T", "Silla Tiffany", "Silla para ceremonias, matrimonios y cenas formales.", "unidad", "4200", "7900"),
      product("MESA-C", "Mesa cocktail", "Mesa alta vestida para recepciones y zonas de networking.", "unidad", "9500", "18500"),
      product("LUZ-AM", "Kit de iluminación ambiental", "Set RGB inalámbrico para ambientación de salones.", "kit", "78000", "145000"),
      product("DECO-T", "Set de decoración temática", "Elementos modulares para fondos, mesas y señalética.", "set", "95000", "178000"),
      service("PROD-IN", "Producción integral de eventos", "Planificación, proveedores y operación completa del evento.", "jornada", "280000", "520000"),
      service("COORD", "Coordinación en terreno", "Coordinación de montaje, programa y cierre operativo.", "hora", "28000", "52000"),
      service("MONTAJE", "Montaje y desmontaje", "Equipo técnico para habilitación y retiro del recinto.", "hora", "22000", "41000"),
      service("DJ-ANI", "Animación y DJ", "Conducción, musicalización y apoyo técnico durante el evento.", "hora", "48000", "85000"),
      service("FOTO", "Fotografía y video", "Registro fotográfico y audiovisual con entrega editada.", "jornada", "210000", "390000"),
      service("CATER", "Catering para invitados", "Servicio de alimentación y atención coordinada.", "persona", "13500", "24900")
    ],
    events: [
      event("Graduación Colegio Los Aromos", "Ceremonia y celebración para estudiantes y familias.", "Gimnasio Colegio Los Aromos", "Puente Alto", "Avenida Demo Escolar 101", "Operación con escenario, pantalla y registro audiovisual."),
      event("Encuentro anual Emprende Chile", "Jornada de networking, charlas y premiación para asociados.", "Centro Convenciones Demo", "Santiago", "Avenida Demo Centro 202", "Acreditación desde las 08:30 y cierre con cóctel."),
      event("Matrimonio Valentina y acompañantes", "Producción de ceremonia, cena y celebración.", "Casona Jardín Demo", "Providencia", "Camino Demo Jardines 303", "Borrador sujeto a visita técnica del recinto."),
      event("Aniversario Centro Cultural La Estación", "Festival comunitario con programación artística.", "Plaza Cultural Demo", "Estación Central", "Pasaje Demo Cultural 404", "Actividad cancelada por reprogramación municipal."),
      event("Celebración familiar Fernanda Lagos", "Ambientación, música y catering para celebración privada.", "Salón Mirador Demo", "Vitacura", "Avenida Demo Norte 505", "Operación en curso con coordinación centralizada.")
    ]
  },
  {
    key: "koke",
    codePrefix: "KOK",
    profile: "Empresa perfumes",
    accountName: "Koke Parfum Demo",
    email: "empresa.koke@demo.kaklen.local",
    firstName: "Koke",
    lastName: "Parfum Demo",
    organizationName: "Koke Parfum Demo SpA",
    legalName: "Koke Parfum Demo SpA",
    organizationType: "LEGAL_ENTITY",
    slug: "demo-koke-parfum",
    rutBody: "76111002",
    clients: [
      company("Perfumería Aura Urbana SpA", "Aura Urbana", "Providencia", "Tienda especializada en fragancias de autor."),
      person("Paula", "Sanhueza", "Ñuñoa", "Compradora particular interesada en aromas florales suaves."),
      company("Salón Estilo Norte Ltda.", "Estilo Norte", "Recoleta", "Peluquería con vitrina de productos de cuidado y perfumería."),
      person("Javiera", "Molina", "La Reina", "Clienta frecuente de sets de regalo personalizados."),
      company("Regalos Bruma SpA", "Bruma Regalos", "Santiago", "Tienda de regalos corporativos y celebraciones."),
      person("Rodrigo", "Pizarro", "Macul", "Revendedor independiente para ferias y redes sociales."),
      company("Distribuidora Esencia Sur Ltda.", "Esencia Sur", "San Miguel", "Distribuidor minorista para comunas del sector sur."),
      person("Isidora", "Leiva", "Las Condes", "Compradora particular de fragancias cítricas y amaderadas."),
      company("Belleza Circular SpA", "Belleza Circular", "Peñalolén", "Tienda consciente con selección de productos reutilizables."),
      person("Sebastián", "Correa", "Providencia", "Cliente de regalos ejecutivos y ediciones limitadas.")
    ],
    catalog: [
      product("EDP-AZ", "Eau de parfum Azahar 50 ml", "Fragancia cítrica floral de concentración intensa.", "unidad", "18500", "39900"),
      product("EDP-BS", "Eau de parfum Bosque 50 ml", "Composición amaderada con notas verdes y resinosas.", "unidad", "19200", "41900"),
      product("BODY-M", "Body mist Mar 120 ml", "Bruma fresca para uso diario con notas acuáticas.", "unidad", "7200", "16900"),
      product("SET-DUO", "Set regalo dúo", "Caja con dos fragancias coordinadas y tarjeta personalizable.", "set", "27500", "57900"),
      product("DISC-K", "Discovery kit Koke", "Selección de seis muestras para explorar familias olfativas.", "kit", "8900", "21900"),
      product("DIF-HOG", "Difusor de hogar 200 ml", "Aroma ambiental de larga duración con varillas de fibra.", "unidad", "9800", "22900"),
      service("DIAG-OLF", "Diagnóstico olfativo", "Sesión guiada para identificar preferencias y familias aromáticas.", "sesión", "18000", "35000"),
      service("PERS-FR", "Personalización de fragancia", "Ajuste de notas y presentación para una experiencia individual.", "unidad", "15000", "32000"),
      service("TALLER", "Taller de perfumería", "Experiencia grupal para crear una composición aromática básica.", "persona", "28000", "59000"),
      service("ASE-RET", "Asesoría para retail", "Curaduría de surtido, exhibición y argumentario de venta.", "hora", "35000", "68000"),
      service("GIFT", "Armado de gift boxes", "Diseño, embalaje y personalización de cajas de regalo.", "unidad", "4500", "9900"),
      service("DESP", "Despacho programado", "Preparación y entrega coordinada dentro de la Región Metropolitana.", "viaje", "6500", "12900")
    ],
    events: [
      event("Taller olfativo Aura Urbana", "Experiencia privada para clientes frecuentes de la perfumería.", "Tienda Aura Urbana", "Providencia", "Avenida Demo Aroma 110", "Incluye discovery kits y estación de personalización."),
      event("Lanzamiento colección Bosque", "Presentación comercial de la colección amaderada.", "Espacio Sensorial Demo", "Las Condes", "Pasaje Demo Esencia 220", "Evento confirmado con prensa e invitados de retail."),
      event("Pop-up Bruma Regalos", "Venta especial y demostraciones de producto para temporada de regalos.", "Galería Centro Demo", "Santiago", "Avenida Demo Comercio 330", "Borrador a la espera de confirmación del espacio."),
      event("Capacitación Esencia Sur", "Capacitación de producto para equipo de distribución.", "Sala Formación Demo", "San Miguel", "Calle Demo Sur 440", "Actividad cancelada y pendiente de nueva fecha."),
      event("Armado campaña corporativa", "Producción de gift boxes para entrega empresarial.", "Taller Koke Demo", "Ñuñoa", "Avenida Demo Taller 550", "Preparación y control de calidad en curso.")
    ]
  },
  {
    key: "carolina",
    codePrefix: "CAR",
    profile: "Persona natural",
    accountName: "Carolina Méndez",
    email: "carolina.mendez@demo.kaklen.local",
    firstName: "Carolina",
    lastName: "Méndez",
    organizationName: "Servicios Carolina Méndez",
    legalName: "Servicios Carolina Méndez",
    organizationType: "NATURAL_PERSON",
    slug: "demo-servicios-carolina-mendez",
    rutBody: "18555003",
    clients: [
      company("Panadería Barrio Vivo EIRL", "Barrio Vivo", "Ñuñoa", "Pequeño negocio que requiere ordenar ventas y operación."),
      person("Daniela", "Soto", "Providencia", "Profesional independiente en transición a servicios recurrentes."),
      company("Estudio Creativo Norte SpA", "Creativo Norte", "Independencia", "Equipo creativo que busca estandarizar proyectos y rentabilidad."),
      person("Felipe", "Araya", "La Florida", "Consultor independiente que necesita estructura comercial."),
      company("Taller Manos Locales Ltda.", "Manos Locales", "Santiago", "Taller de oficios con desafíos de planificación y capacidad."),
      person("Marcela", "Vega", "Macul", "Emprendedora que prepara su primera oferta de talleres."),
      company("Café Punto Encuentro SpA", "Punto Encuentro", "San Joaquín", "Cafetería de barrio en proceso de ordenar costos y turnos."),
      person("Andrés", "Salinas", "Peñalolén", "Profesional que requiere mentoría para validar un nuevo servicio."),
      company("Consultora Ruta Simple Ltda.", "Ruta Simple", "Las Condes", "Consultora pequeña que busca documentar procesos internos."),
      person("Lorena", "Castillo", "Santiago", "Clienta particular inscrita en talleres de organización financiera.")
    ],
    catalog: [
      product("KIT-PLAN", "Kit de planificación estratégica", "Material impreso para objetivos, iniciativas y seguimiento trimestral.", "kit", "8500", "19900"),
      product("CUAD-TR", "Cuaderno de trabajo", "Cuaderno guiado para sesiones de mentoría y talleres.", "unidad", "4200", "9900"),
      product("TARJ-FAC", "Tarjetas de facilitación", "Set de preguntas y dinámicas para equipos pequeños.", "set", "7800", "17900"),
      product("PLANT-FIN", "Plantilla financiera impresa", "Pack de hojas para flujo de caja, costos y metas.", "pack", "3500", "8900"),
      product("KIT-TALL", "Kit para talleres", "Material de apoyo, notas adhesivas y guías para participantes.", "kit", "6900", "15900"),
      product("MAN-PROC", "Manual de procesos", "Documento físico personalizado con flujos y responsabilidades.", "unidad", "12500", "29000"),
      service("ASE-EST", "Asesoría estratégica", "Sesión para priorizar objetivos y diseñar un plan de acción.", "hora", "32000", "65000"),
      service("MENT-IND", "Mentoría individual", "Acompañamiento personalizado para decisiones y seguimiento.", "sesión", "28000", "58000"),
      service("TALL-VTA", "Taller de ventas", "Taller práctico de propuesta de valor y conversación comercial.", "persona", "22000", "45000"),
      service("DIAG-NEG", "Diagnóstico de negocio", "Revisión estructurada de operación, finanzas y oportunidades.", "proyecto", "95000", "190000"),
      service("DIS-PROC", "Diseño de procesos", "Levantamiento y documentación de procesos críticos.", "proyecto", "140000", "290000"),
      service("FAC-EQ", "Facilitación de equipos", "Diseño y conducción de sesiones de trabajo colaborativo.", "jornada", "160000", "320000")
    ],
    events: [
      event("Taller de ventas Barrio Vivo", "Jornada práctica para ordenar oferta y conversación comercial.", "Sala Comunitaria Demo", "Ñuñoa", "Pasaje Demo Emprende 115", "Material preparado para seis participantes."),
      event("Jornada de procesos Ruta Simple", "Levantamiento colaborativo de procesos y responsabilidades.", "Oficina Ruta Simple", "Las Condes", "Avenida Demo Gestión 225", "Sesión confirmada con líderes de cada área."),
      event("Mentoría grupal independientes", "Encuentro para revisar propuestas de valor y próximos experimentos.", "Cowork Demo", "Providencia", "Calle Demo Trabajo 335", "Borrador sujeto a confirmación de participantes."),
      event("Taller financiero abierto", "Taller para ordenar costos, precios y flujo de caja.", "Biblioteca Local Demo", "Santiago", "Avenida Demo Aprendizaje 445", "Actividad cancelada por baja inscripción."),
      event("Diagnóstico Café Punto Encuentro", "Trabajo en terreno para observar operación y turnos.", "Café Punto Encuentro", "San Joaquín", "Pasaje Demo Café 555", "Observación y entrevistas breves en curso.")
    ]
  },
  {
    key: "tomas",
    codePrefix: "TOM",
    profile: "Persona natural",
    accountName: "Tomás Rivera",
    email: "tomas.rivera@demo.kaklen.local",
    firstName: "Tomás",
    lastName: "Rivera",
    organizationName: "Producciones Tomás Rivera",
    legalName: "Producciones Tomás Rivera",
    organizationType: "NATURAL_PERSON",
    slug: "demo-producciones-tomas-rivera",
    rutBody: "18555004",
    clients: [
      company("Banda Horizonte Sonoro Ltda.", "Horizonte Sonoro", "Santiago", "Banda independiente con presentaciones y lanzamientos."),
      person("Ignacio", "Reyes", "Providencia", "Músico solista que prepara un concierto de lanzamiento."),
      company("Restaurante Patio Central SpA", "Patio Central", "Ñuñoa", "Restaurante con programación musical de fin de semana."),
      person("Antonia", "Mardones", "La Florida", "Productora independiente que coordina ciclos culturales."),
      company("Centro Cultural Nueva Escena", "Nueva Escena", "San Miguel", "Centro cultural con conciertos, teatro y talleres."),
      person("Cristóbal", "Navarro", "Macul", "Técnico de sonido que subcontrata equipamiento y operación."),
      company("Colegio Artístico Violeta Parra", "Colegio Violeta Parra", "Quilicura", "Comunidad escolar con festivales y muestras artísticas."),
      person("Bárbara", "Olivares", "Independencia", "Cantautora que requiere producción técnica para una sesión en vivo."),
      company("Productora Escenario Abierto SpA", "Escenario Abierto", "Estación Central", "Productora de ferias, festivales y activaciones públicas."),
      person("Gonzalo", "Tapia", "Recoleta", "Gestor cultural encargado de una temporada de conciertos.")
    ],
    catalog: [
      product("MIC-DIN", "Micrófono dinámico profesional", "Micrófono robusto para voces e instrumentos en vivo.", "unidad", "68000", "115000"),
      product("MON-PISO", "Monitor de piso activo", "Monitor amplificado para mezcla de escenario.", "unidad", "245000", "390000"),
      product("PAR-LED", "Luminaria PAR LED", "Luminaria RGBW para color y ambientación escénica.", "unidad", "72000", "128000"),
      product("ATRIL", "Atril profesional", "Atril ajustable de base pesada para escenario.", "unidad", "24000", "45000"),
      product("CABLE-XLR", "Kit de cableado XLR", "Set de cables balanceados rotulados para montaje.", "kit", "39000", "75000"),
      product("ESC-MOV", "Escenario móvil modular", "Módulos de tarima, faldón y acceso para montaje temporal.", "m2", "85000", "150000"),
      service("PROD-TEC", "Producción técnica", "Diseño técnico, coordinación y operación general.", "jornada", "240000", "450000"),
      service("SON-VIVO", "Sonido en vivo", "Sistema, montaje y operación de audio para presentación.", "hora", "55000", "98000"),
      service("ILU-ESC", "Iluminación escénica", "Diseño y operación de iluminación para escena y público.", "hora", "48000", "89000"),
      service("STAGE", "Stage management", "Coordinación de escenario, cambios y tiempos de programa.", "hora", "36000", "68000"),
      service("GRAB-MULT", "Grabación multipista", "Captura multipista y entrega organizada para postproducción.", "jornada", "180000", "340000"),
      service("BACKLINE", "Backline y operación", "Provisión, preparación y asistencia técnica de instrumentos.", "jornada", "150000", "285000")
    ],
    events: [
      event("Concierto Horizonte Sonoro", "Presentación de repertorio original con producción técnica completa.", "Sala Nueva Escena", "San Miguel", "Avenida Demo Escena 120", "Incluye grabación multipista y operación de luces."),
      event("Festival Colegio Violeta Parra", "Muestra artística escolar con bandas y presentaciones escénicas.", "Patio Colegio Violeta Parra", "Quilicura", "Pasaje Demo Música 230", "Evento confirmado con montaje desde primera hora."),
      event("Ciclo acústico Patio Central", "Programación de música en vivo para terraza del restaurante.", "Restaurante Patio Central", "Ñuñoa", "Calle Demo Patio 340", "Borrador pendiente de programación de artistas."),
      event("Sesión en vivo Bárbara Olivares", "Grabación audiovisual de repertorio acústico.", "Estudio Demo Norte", "Independencia", "Avenida Demo Audio 450", "Actividad cancelada por indisponibilidad del estudio."),
      event("Montaje Escenario Abierto", "Preparación técnica de feria cultural con dos escenarios.", "Parque Cultural Demo", "Estación Central", "Pasaje Demo Festival 560", "Montaje técnico y pruebas en curso.")
    ]
  }
];

export const LEGACY_DEMO_SLUGS = [
  { email: "empresa.angela@demo.kaklen.local", slug: "demo-angela-producciones" },
  { email: "empresa.koke@demo.kaklen.local", slug: "demo-koke-eventos" },
  { email: "carolina.mendez@demo.kaklen.local", slug: "demo-mendez-experiencias" },
  { email: "tomas.rivera@demo.kaklen.local", slug: "demo-rivera-operaciones" }
];

function company(legalName, tradeName, city, notes) {
  return { type: "LEGAL_ENTITY", legalName, tradeName, city, notes };
}

function person(firstName, lastName, city, notes) {
  return { type: "NATURAL_PERSON", firstName, lastName, city, notes };
}

function product(code, name, description, unit, cost, price) {
  return { type: "PRODUCT", code, name, description, unit, cost, price };
}

function service(code, name, description, unit, cost, price) {
  return { type: "SERVICE", code, name, description, unit, cost, price };
}

function event(name, description, venueName, city, address, notes) {
  return { name, description, venueName, city, address, notes };
}
