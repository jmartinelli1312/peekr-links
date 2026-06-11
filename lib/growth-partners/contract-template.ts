// Founding Country Growth Partner Agreement — structured template.
// Text is verbatim from the source Word doc (ES) plus professional EN/PT
// translations; per-partner values are injected via {{placeholders}}.
// Rendered to PDF by contract-pdf.tsx.

export type Lang = "es" | "en" | "pt";

export type Block =
  | { t: "h1"; x: string }
  | { t: "h2"; x: string }
  | { t: "p"; x: string }
  | { t: "li"; x: string };

export type ContractFields = {
  country: string; // e.g. "Argentina"
  effectiveDate: string; // e.g. "10 de junio de 2026"
  partnerName: string; // legal name
  brandName: string; // company / brand acting through
  username: string; // social handle / account
  percentage: number; // e.g. 5
  docNumber?: string; // partner's ID / passport number
  docCountry?: string; // country that issued the document
  language?: Lang; // contract language (default "es")
};

// ── Percentage in words, per language ───────────────────────────────────────
const PCT_WORDS: Record<Lang, Record<string, string>> = {
  es: {
    "1": "uno por ciento", "2": "dos por ciento", "3": "tres por ciento",
    "4": "cuatro por ciento", "5": "cinco por ciento", "6": "seis por ciento",
    "7": "siete por ciento", "8": "ocho por ciento", "9": "nueve por ciento",
    "10": "diez por ciento",
  },
  en: {
    "1": "one percent", "2": "two percent", "3": "three percent",
    "4": "four percent", "5": "five percent", "6": "six percent",
    "7": "seven percent", "8": "eight percent", "9": "nine percent",
    "10": "ten percent",
  },
  pt: {
    "1": "um por cento", "2": "dois por cento", "3": "três por cento",
    "4": "quatro por cento", "5": "cinco por cento", "6": "seis por cento",
    "7": "sete por cento", "8": "oito por cento", "9": "nove por cento",
    "10": "dez por cento",
  },
};

function pctWords(p: number, lang: Lang): string {
  const tail = lang === "en" ? "percent" : "por cento";
  const tailEs = "por ciento";
  return PCT_WORDS[lang][String(p)] ?? `${p} ${lang === "es" ? tailEs : tail}`;
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ── Country adjective ("argentina", "Argentine", "argentina"), per language ──
const COUNTRY_ADJ: Record<Lang, Record<string, string>> = {
  es: {
    Argentina: "argentina", "Panamá": "panameña", "México": "mexicana",
    Colombia: "colombiana", Chile: "chilena", "Perú": "peruana",
    Brasil: "brasileña", "España": "española",
  },
  en: {
    Argentina: "Argentine", "Panamá": "Panamanian", "México": "Mexican",
    Colombia: "Colombian", Chile: "Chilean", "Perú": "Peruvian",
    Brasil: "Brazilian", "España": "Spanish",
  },
  pt: {
    Argentina: "argentina", "Panamá": "panamenha", "México": "mexicana",
    Colombia: "colombiana", Chile: "chilena", "Perú": "peruana",
    Brasil: "brasileira", "España": "espanhola",
  },
};

function countryAdj(country: string, lang: Lang): string {
  const hit = COUNTRY_ADJ[lang][country];
  if (hit) return hit;
  if (lang === "en") return country;
  return `de ${country}`;
}

function docId(docNum: string, docCty: string, lang: Lang): string {
  if (!docNum) return "";
  if (lang === "en") {
    return `, identified by document No. ${docNum}${docCty ? ` issued in ${docCty}` : ""}`;
  }
  if (lang === "pt") {
    return `, identificado com o documento No. ${docNum}${docCty ? ` emitido em ${docCty}` : ""}`;
  }
  return `, identificado con documento No. ${docNum}${docCty ? ` emitido en ${docCty}` : ""}`;
}

// ── Templates per language. One entry per paragraph/heading/bullet. ──────────

const TEMPLATE_ES: Block[] = [
  { t: "h1", x: "ACUERDO FOUNDING COUNTRY GROWTH PARTNER" },
  { t: "h1", x: "{{COUNTRY_UPPER}}" },
  { t: "p", x: "El presente Founding Country Growth Partner Agreement (el “Acuerdo”) se celebra con fecha {{effectiveDate}}, entre:" },
  { t: "p", x: "EMANATION FILMS, INC., una sociedad constituida conforme a las leyes de la República de Panamá, DUNS Number 727265117, propietaria y operadora de la plataforma Peekr, representada por su Representante Legal, JORGE ENRIQUE MARTINELLI REMOND, con identificación panameña No. 8-713-1063 (en adelante, “Peekr” o la “Compañía”), y {{partnerName}}{{docId}}, actuando a través de o en nombre de {{brandName}}, incluyendo la marca, cuenta, presencia pública y/o ecosistema de redes sociales {{username}} (en adelante, el “Partner”). Peekr y el Partner podrán ser denominados individualmente como una “Parte” y conjuntamente como las “Partes”." },

  { t: "h2", x: "1. OBJETO" },
  { t: "p", x: "El objeto de este Acuerdo es establecer una alianza estratégica de largo plazo mediante la cual el Partner actuará como Founding Country Growth Partner para {{country}} y contribuirá activamente al crecimiento, adopción, desarrollo del ecosistema de creadores y expansión de la comunidad de Peekr dentro de {{country}}." },
  { t: "p", x: "Las Partes reconocen que esta relación va más allá de una campaña tradicional de influencer y está concebida como una colaboración estratégica enfocada en construir la comunidad {{countryAdj}} de Peekr." },

  { t: "h2", x: "2. DESIGNACIÓN" },
  { t: "p", x: "Peekr designa al Partner como: FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}}. El Partner acepta dicha designación. Las Partes reconocen que Peekr podrá designar otros creadores, influencers, embajadores, asesores o socios estratégicos dentro de {{country}}. El Partner acepta apoyar activamente el crecimiento de la comunidad y podrá colaborar en la identificación, presentación y desarrollo de relaciones con potenciales creadores, influencers, embajadores y oportunidades estratégicas." },

  { t: "h2", x: "3. PLAZO" },
  { t: "p", x: "El plazo inicial de este Acuerdo será de tres (3) años contados a partir de la Fecha de Vigencia." },

  { t: "h2", x: "4. DERECHOS DE PARTICIPACIÓN {{COUNTRY_UPPER}}" },
  { t: "p", x: "A partir de la firma de este Acuerdo, el Partner será reconocido como titular de derechos de participación económica equivalentes al {{pctWords}} ({{pct}}%) de los Derechos de Participación {{country}}." },
  { t: "p", x: "Dichos derechos son únicamente derechos contractuales de participación económica y no constituyen: participación accionaria, acciones, derechos de voto, derechos de directorio, derechos de gobierno corporativo, propiedad intelectual, derechos laborales, participación societaria ni relación de agencia, salvo acuerdo escrito en contrario." },

  { t: "h2", x: "5. PARTICIPACIÓN EN INGRESOS OPERATIVOS" },
  { t: "p", x: "El Partner tendrá derecho al {{pctWords}} ({{pct}}%) de los Ingresos Netos {{country}} atribuibles a los Derechos de Participación {{country}}." },
  { t: "p", x: "Los Ingresos Netos {{country}} incluirán los ingresos generados en o atribuibles a {{country}} por: publicidad, sponsored discovery, affiliate marketing, suscripciones premium, licencias, alianzas, APIs, productos de data, campañas con creadores, campañas de marca y futuras iniciativas de monetización." },
  { t: "p", x: "Antes de cualquier distribución, Peekr podrá deducir: impuestos aplicables, retenciones, cargos bancarios, comisiones de procesamiento de pagos, costos de conversión de moneda, gastos directos de transacción y deducciones legalmente exigidas. Los gastos corporativos generales, incluyendo desarrollo de software, infraestructura, empleados, gastos operativos y otros costos corporativos globales, no serán deducidos de los Derechos de Participación {{country}} salvo acuerdo escrito entre las Partes." },

  { t: "h2", x: "6. EVENTOS DE LIQUIDEZ" },
  { t: "p", x: "El Partner participará en adquisiciones, fusiones, inversiones estratégicas, ventas de acciones, ventas de activos y otros eventos de liquidez que involucren a Peekr, únicamente en la medida en que dicho evento resulte en fondos distribuibles o valor económico efectivamente atribuible a los Derechos de Participación {{country}}." },
  { t: "p", x: "A los efectos de determinar el valor atribuible a {{country}}, la metodología base será: MAU {{country}} ÷ MAU Global, medido inmediatamente antes de la transacción." },
  { t: "p", x: "Ejemplo: si {{country}} representa el cincuenta por ciento (50%) de los usuarios activos mensuales de Peekr y una transacción valora a Peekr en USD 10,000,000, entonces USD 5,000,000 se considerarán atribuibles a {{country}}. El Partner tendrá derecho al {{pctWords}} ({{pct}}%) del valor atribuible a {{country}}, sujeto a los términos de este Acuerdo." },
  { t: "p", x: "Si futuros inversores, compradores o socios estratégicos requirieran una metodología diferente, el Partner acepta que Peekr podrá negociar e implementar una metodología alternativa razonable, siempre que se preserve la participación económica equivalente al {{pctWords}} ({{pct}}%) del valor atribuible a {{country}}." },
  { t: "p", x: "Los impuestos, honorarios legales, honorarios de banca de inversión, costos de transacción y gastos directos relacionados con dicha transacción podrán deducirse antes de calcular los montos distribuibles." },

  { t: "h2", x: "7. DISTRIBUCIÓN DE FONDOS" },
  { t: "p", x: "Las Partes reconocen que los derechos de participación del Partner le otorgan derecho a recibir distribuciones únicamente cuando efectivo, fondos u otro valor económico sean efectivamente distribuidos a los titulares de Derechos de Participación {{country}}." },
  { t: "p", x: "En consecuencia, la mera recepción por parte de Peekr de capital de inversión, financiamiento de venture capital, inversión estratégica, nota convertible, SAFE, financiamiento de deuda o aportes de capital similares no constituirá por sí misma un evento distribuible." },
  { t: "p", x: "Si los fondos recibidos de inversores permanecen dentro de Peekr y son utilizados para desarrollo de producto, operaciones, marketing, expansión, contrataciones, capital de trabajo, adquisiciones, infraestructura, crecimiento de comunidad o cualquier otro propósito corporativo, dichos fondos no serán considerados fondos distribuidos y no generarán obligación de pago al Partner." },
  { t: "p", x: "El Partner participará únicamente en distribuciones reales de valor económico atribuible a los Derechos de Participación {{country}}, incluyendo, sin limitarse a: distribuciones de dividendos, distribuciones de utilidades, fondos de venta distribuidos a titulares de participación, fondos de fusión distribuidos a titulares de participación, fondos de adquisición distribuidos a titulares de participación, eventos de liquidez que resulten en distribuciones de efectivo y otras distribuciones expresamente declaradas por Peekr." },
  { t: "p", x: "Ejemplo: si Peekr recibe una inversión de venture capital de USD 5,000,000 y la totalidad de los fondos permanece dentro de la Compañía para crecimiento y operaciones, no se considerará que ha ocurrido una distribución y no se adeudará pago alguno al Partner." },

  { t: "h2", x: "8. REQUISITOS DE PARTICIPACIÓN ACTIVA" },
  { t: "p", x: "El Partner acepta incorporar Peekr de forma orgánica dentro de su ecosistema de contenido como una herramienta real para listas, calificaciones, recomendaciones e interacción con su audiencia. La participación activa del Partner incluirá:" },
  { t: "li", x: "Mantener una cuenta y perfil público activo en Peekr." },
  { t: "li", x: "Calificar películas y contenido televisivo regularmente dentro de Peekr." },
  { t: "li", x: "Crear y mantener Peeklists públicas y recomendaciones dentro de la plataforma." },
  { t: "li", x: "Usar Peekr públicamente como parte de su flujo de trabajo de entretenimiento, recomendaciones y contenido." },
  { t: "li", x: "Fomentar la adopción por parte de la audiencia e invitar a sus seguidores a seguir el perfil del Partner en Peekr." },
  { t: "li", x: "Mantener un enlace visible a Peekr dentro de su link principal de bio o agregador de enlaces, sujeto a limitaciones de plataforma y flexibilidad editorial razonable." },
  { t: "li", x: "Mencionar Peekr de forma orgánica en captions, videos de YouTube, Instagram, TikTok, Facebook y otros canales cuando naturalmente tenga sentido dentro del contexto del contenido del Partner." },
  { t: "li", x: "Apoyar el onboarding de creadores y presentaciones estratégicas con otros creadores relevantes en {{country}} cuando sea razonablemente posible." },
  { t: "li", x: "Participar en conversaciones estratégicas y brindar feedback sobre mejoras de producto, oportunidades de mercado y crecimiento de comunidad." },

  { t: "h2", x: "9. OBLIGACIONES DE CONTENIDO" },
  { t: "p", x: "Las Partes acuerdan que las obligaciones promocionales del Partner serán principalmente orgánicas e integradas al flujo normal de contenido del Partner, y no una obligación rígida de volumen semanal." },
  { t: "p", x: "La obligación de contenido dedicado del Partner consistirá en un (1) Reel o video promocional dedicado a Peekr cada tres (3) meses durante el Plazo. Cada Reel o video dedicado tendrá como finalidad presentar Peekr al público, explicar el valor de la plataforma para listas, calificaciones, recomendaciones, películas y series, incentivar descargas y adopción de usuarios, e invitar a la audiencia a seguir el perfil del Partner dentro de Peekr." },
  { t: "p", x: "Cada Reel o video dedicado deberá ser razonablemente apto para uso en publicidad paga, sujeto siempre a la aprobación previa del Partner para cualquier uso en medios pagos conforme a la Cláusula 13." },
  { t: "p", x: "Además del Reel o video dedicado trimestral, el Partner incorporará orgánicamente Peekr dentro de su ecosistema mediante el uso de la plataforma, Peeklists, calificaciones, recomendaciones, captions, menciones en videos y otras referencias cuando naturalmente tenga sentido. Dichas menciones orgánicas no serán tratadas como una obligación rígida de volumen semanal." },
  { t: "p", x: "La intención es que el Partner incorpore genuinamente Peekr dentro de su ecosistema de creador como una herramienta recurrente de referencia para descubrimiento, listas, calificaciones y recomendaciones de películas y series." },

  { t: "h2", x: "10. INTEGRACIÓN EN PERFIL" },
  { t: "p", x: "El Partner mantendrá un enlace visible a Peekr dentro de su link principal de bio o agregador de enlaces siempre que sea razonablemente posible, y alentará a sus seguidores a conectarse a través de Peekr y seguir su perfil dentro de la plataforma." },

  { t: "h2", x: "11. ROL DE ASESORÍA ESTRATÉGICA" },
  { t: "p", x: "El Partner actuará como asesor respecto de:" },
  { t: "li", x: "Reclutamiento de creadores." },
  { t: "li", x: "Crecimiento de comunidad." },
  { t: "li", x: "Oportunidades de mercado." },
  { t: "li", x: "Adaptación cultural." },
  { t: "li", x: "Presentaciones estratégicas." },
  { t: "li", x: "Feedback de producto." },
  { t: "li", x: "Desarrollo del ecosistema de entretenimiento." },

  { t: "h2", x: "12. ACCESO A DASHBOARD, REPORTES Y DERECHO DE AUDITORÍA" },
  { t: "p", x: "Peekr proporcionará al Partner acceso a un Growth Partner Dashboard, sujeto a disponibilidad técnica y prioridades de desarrollo." },
  { t: "p", x: "Sujeto a disponibilidad, el Dashboard podrá incluir:" },
  { t: "li", x: "MAU, WAU y DAU de {{country}}." },
  { t: "li", x: "Métricas de referidos." },
  { t: "li", x: "Performance de contenido." },
  { t: "li", x: "Crecimiento de comunidad." },
  { t: "li", x: "Analítica de engagement." },
  { t: "li", x: "Métricas de ingresos atribuibles a {{country}}, cuando la monetización esté activa y sea razonablemente medible." },
  { t: "p", x: "Toda la información del Dashboard constituirá Información Confidencial." },
  { t: "p", x: "Peekr proporcionará al Partner reportes periódicos respecto de los Derechos de Participación {{country}}, ya sea mediante el Dashboard o mediante reportes escritos, cuando ocurran monetización, distribuciones o eventos de liquidez relevantes para {{country}}." },
  { t: "p", x: "El Partner tendrá un derecho razonable de auditoría sobre registros directamente relacionados con el cálculo de Ingresos Netos {{country}} o Derechos de Participación {{country}}, no más de una vez por año calendario, previa notificación escrita razonable, a través de un asesor profesional independiente sujeto a confidencialidad. Toda auditoría se realizará en horario comercial normal, de manera que no interfiera irrazonablemente con las operaciones comerciales de Peekr y se limitará a la información razonablemente necesaria para verificar los cálculos correspondientes." },

  { t: "h2", x: "13. USO DE NOMBRE, IMAGEN Y SEMEJANZA; APROBACIÓN DE MEDIOS PAGOS" },
  { t: "p", x: "El Partner otorga a Peekr un derecho mundial, libre de regalías, para identificar al Partner y a su marca o empresa como FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}} y para usar su nombre, imagen, voz, handles sociales, contenido público y testimonios en relación con marketing, publicidad, presentaciones a inversores, relaciones públicas, desarrollo comercial y campañas promocionales relacionadas con Peekr, sujeto a las limitaciones establecidas en esta Cláusula." },
  { t: "p", x: "Cualquier publicidad paga, campaña de medios pagos, publicación impulsada, dark post, whitelisted advertisement, spark ad, creator ad u otro uso promocional pago que involucre la imagen, voz, perfil, handle, contenido o semejanza del Partner requerirá aprobación previa del Partner. Dicha aprobación incluirá alineación sobre el corte final, texto, formato, contexto de campaña y período de uso." },
  { t: "p", x: "La aprobación del Partner no será irrazonablemente denegada, condicionada o demorada, siempre que el uso propuesto preserve el lenguaje, credibilidad, estilo editorial y posicionamiento del Partner. Cualquier uso comercial más amplio, campaña materialmente mayor, uso extendido en medios pagos o contexto materialmente diferente deberá ser conversado y aprobado por separado." },

  { t: "h2", x: "14. CONFIDENCIALIDAD" },
  { t: "p", x: "El Partner mantendrá estricta confidencialidad respecto de: roadmap de producto, información financiera, métricas, conversaciones con inversores, estrategia de crecimiento, conversaciones de alianzas, información técnica, información del Dashboard y cualquier otra información no pública divulgada por Peekr." },
  { t: "p", x: "Estas obligaciones permanecerán vigentes durante el Plazo y por dos (2) años posteriores a la terminación." },

  { t: "h2", x: "15. EXCLUSIVIDAD Y NO COMPETENCIA LIMITADA" },
  { t: "p", x: "Durante el Plazo, el Partner no promocionará, asesorará, invertirá, actuará como embajador ni respaldará públicamente ninguna aplicación o plataforma directamente competidora cuyo negocio principal sea sustancialmente similar al de Peekr en el segmento de descubrimiento social de entretenimiento, recomendación, calificación, creación de listas, seguimiento, gestión de watchlist o interacción comunitaria sobre películas y series de televisión." },
  { t: "p", x: "Esta exclusividad y no competencia limitada aplicará únicamente a competidores directos de Peekr y solo durante el Plazo. No impedirá al Partner trabajar con plataformas de streaming, productoras, distribuidoras, festivales, marcas, prensa, cine, televisión, empresas de entretenimiento, medios de comunicación o campañas generales de entretenimiento, siempre que dicho trabajo no involucre la promoción o desarrollo de una aplicación o plataforma directamente competidora según lo descrito anteriormente." },
  { t: "p", x: "El propósito de esta cláusula es proteger la información confidencial, estrategia interna, roadmap de producto, métricas y planes de crecimiento de Peekr para que no sean utilizados, directa o indirectamente, para apoyar el desarrollo, promoción o crecimiento de una aplicación o plataforma competidora." },

  { t: "h2", x: "16. SALIDA ANTICIPADA, VESTING Y CLAWBACK" },
  { t: "p", x: "La participación otorgada en este Acuerdo tiene por objeto compensar la contribución de largo plazo durante el Plazo Inicial." },
  { t: "p", x: "Si el Partner se retira voluntariamente, abandona la alianza, incumple materialmente este Acuerdo o se vuelve inactivo, y dicha situación no es subsanada dentro del período de cura aplicable establecido en la Cláusula 18, la participación retenida por el Partner se determinará de la siguiente manera:" },
  { t: "p", x: "Luego de completar el Año 1: el Partner retiene permanentemente {{y1}}%." },
  { t: "p", x: "Luego de completar el Año 2: el Partner retiene permanentemente {{y2}}%." },
  { t: "p", x: "Luego de completar el Año 3: el Partner retiene permanentemente {{pct}}%." },
  { t: "p", x: "Cualquier participación no consolidada o perdida revertirá automáticamente a Peekr. No habrá pérdida de participación por demoras ordinarias, desacuerdos de buena fe, discreción editorial razonable o incumplimientos aislados que sean subsanados dentro del período de cura aplicable." },

  { t: "h2", x: "17. ABANDONO" },
  { t: "p", x: "Se considerará que el Partner está inactivo o ha abandonado la alianza si, luego de notificación escrita y falta de subsanación dentro del período de cura aplicable, ocurre cualquiera de las siguientes situaciones:" },
  { t: "li", x: "No hay actividad significativa en Peekr durante noventa (90) días consecutivos." },
  { t: "li", x: "El Partner cesa el uso público de Peekr." },
  { t: "li", x: "El Partner cesa toda integración razonable de Peekr dentro de su ecosistema." },
  { t: "li", x: "El Partner incumple repetidamente la obligación de contenido trimestral dedicado." },
  { t: "li", x: "El Partner se vuelve inubicable durante noventa (90) días consecutivos." },

  { t: "h2", x: "18. NOTIFICACIÓN Y PERÍODO DE CURA" },
  { t: "p", x: "Salvo por la Cláusula de Bad Actor establecida en la Cláusula 19 u otra conducta grave que cause daño material e inmediato a Peekr, ninguna Parte podrá declarar incumplimiento material, inactividad, abandono o pérdida de participación sin antes proporcionar notificación escrita describiendo el supuesto incumplimiento con detalle razonable y otorgando a la otra Parte sesenta (60) días para subsanar dicho incumplimiento." },
  { t: "p", x: "Si el incumplimiento es susceptible de subsanación y se subsana dentro de dicho período de sesenta (60) días, no habrá pérdida de participación ni terminación basada en dicho incumplimiento. Las Partes actuarán de buena fe para resolver cuestiones operativas, creativas o de desempeño antes de aplicar cualquier pérdida de participación." },

  { t: "h2", x: "19. CLÁUSULA DE BAD ACTOR" },
  { t: "p", x: "Peekr podrá terminar este Acuerdo inmediatamente, sin período de cura, si el Partner incurre en:" },
  { t: "li", x: "Fraude." },
  { t: "li", x: "Seguidores falsos." },
  { t: "li", x: "Manipulación artificial de engagement." },
  { t: "li", x: "Conducta criminal." },
  { t: "li", x: "Discurso de odio." },
  { t: "li", x: "Conducta materialmente dañina para la reputación de Peekr." },
  { t: "li", x: "Divulgación o uso indebido intencional de información confidencial de Peekr para construir, apoyar o promover un competidor directo." },

  { t: "h2", x: "20. IMPUESTOS" },
  { t: "p", x: "Cada Parte será exclusivamente responsable de sus propias obligaciones fiscales. Cualquier retención, cargo gubernamental, comisión bancaria, costo de transacción o deducción legalmente exigida podrá ser retenida antes de cualquier distribución. El Partner será exclusivamente responsable de declarar y pagar los impuestos correspondientes en {{country}} o en cualquier otra jurisdicción aplicable." },

  { t: "h2", x: "21. CONTRATISTA INDEPENDIENTE" },
  { t: "p", x: "Nada en este Acuerdo creará una relación laboral, sociedad, joint venture o agencia entre las Partes." },

  { t: "h2", x: "22. LEY APLICABLE" },
  { t: "p", x: "Este Acuerdo se regirá por las leyes de la República de Panamá, dado que EMANATION FILMS, INC. es una sociedad constituida conforme a las leyes de la República de Panamá." },

  { t: "h2", x: "23. RESOLUCIÓN DE DISPUTAS" },
  { t: "p", x: "Cualquier disputa derivada de este Acuerdo será sometida primero a negociación de buena fe entre las Partes." },
  { t: "p", x: "Si la disputa no se resolviera, será sometida a arbitraje vinculante en Ciudad de Panamá, República de Panamá, salvo que las Partes acuerden mutuamente por escrito un foro alternativo, proceso de mediación o mecanismo de resolución de disputas que sea práctico y equilibrado para ambas Partes." },

  { t: "h2", x: "24. ACUERDO COMPLETO" },
  { t: "p", x: "Este Acuerdo constituye el acuerdo completo entre las Partes y reemplaza todas las conversaciones y comunicaciones previas." },
];

const TEMPLATE_EN: Block[] = [
  { t: "h1", x: "FOUNDING COUNTRY GROWTH PARTNER AGREEMENT" },
  { t: "h1", x: "{{COUNTRY_UPPER}}" },
  { t: "p", x: "This Founding Country Growth Partner Agreement (the “Agreement”) is entered into as of {{effectiveDate}}, by and between:" },
  { t: "p", x: "EMANATION FILMS, INC., a company incorporated under the laws of the Republic of Panama, DUNS Number 727265117, owner and operator of the Peekr platform, represented by its Legal Representative, JORGE ENRIQUE MARTINELLI REMOND, holder of Panamanian identification No. 8-713-1063 (hereinafter, “Peekr” or the “Company”), and {{partnerName}}{{docId}}, acting through or on behalf of {{brandName}}, including the brand, account, public presence and/or social media ecosystem {{username}} (hereinafter, the “Partner”). Peekr and the Partner may be referred to individually as a “Party” and collectively as the “Parties.”" },

  { t: "h2", x: "1. PURPOSE" },
  { t: "p", x: "The purpose of this Agreement is to establish a long-term strategic alliance whereby the Partner shall act as Founding Country Growth Partner for {{country}} and actively contribute to the growth, adoption, creator ecosystem development, and community expansion of Peekr within {{country}}." },
  { t: "p", x: "The Parties acknowledge that this relationship goes beyond a traditional influencer campaign and is conceived as a strategic collaboration focused on building Peekr's {{countryAdj}} community." },

  { t: "h2", x: "2. APPOINTMENT" },
  { t: "p", x: "Peekr appoints the Partner as: FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}}. The Partner accepts such appointment. The Parties acknowledge that Peekr may appoint other creators, influencers, ambassadors, advisors or strategic partners within {{country}}. The Partner agrees to actively support community growth and may collaborate in identifying, introducing and developing relationships with potential creators, influencers, ambassadors and strategic opportunities." },

  { t: "h2", x: "3. TERM" },
  { t: "p", x: "The initial term of this Agreement shall be three (3) years from the Effective Date." },

  { t: "h2", x: "4. {{COUNTRY_UPPER}} PARTICIPATION RIGHTS" },
  { t: "p", x: "As of the execution of this Agreement, the Partner shall be recognized as the holder of economic participation rights equal to {{pctWords}} ({{pct}}%) of the {{country}} Participation Rights." },
  { t: "p", x: "Such rights are solely contractual economic participation rights and do not constitute: equity, shares, voting rights, board rights, corporate governance rights, intellectual property, labor rights, corporate ownership, or an agency relationship, unless otherwise agreed in writing." },

  { t: "h2", x: "5. PARTICIPATION IN OPERATING REVENUE" },
  { t: "p", x: "The Partner shall be entitled to {{pctWords}} ({{pct}}%) of the {{country}} Net Revenue attributable to the {{country}} Participation Rights." },
  { t: "p", x: "The {{country}} Net Revenue shall include revenue generated in or attributable to {{country}} from: advertising, sponsored discovery, affiliate marketing, premium subscriptions, licensing, partnerships, APIs, data products, creator campaigns, brand campaigns, and future monetization initiatives." },
  { t: "p", x: "Prior to any distribution, Peekr may deduct: applicable taxes, withholdings, bank charges, payment processing fees, currency conversion costs, direct transaction expenses, and legally required deductions. General corporate expenses, including software development, infrastructure, employees, operating expenses and other global corporate costs, shall not be deducted from the {{country}} Participation Rights unless agreed in writing between the Parties." },

  { t: "h2", x: "6. LIQUIDITY EVENTS" },
  { t: "p", x: "The Partner shall participate in acquisitions, mergers, strategic investments, share sales, asset sales and other liquidity events involving Peekr, solely to the extent that such event results in distributable funds or economic value actually attributable to the {{country}} Participation Rights." },
  { t: "p", x: "For purposes of determining the value attributable to {{country}}, the base methodology shall be: {{country}} MAU ÷ Global MAU, measured immediately prior to the transaction." },
  { t: "p", x: "Example: if {{country}} represents fifty percent (50%) of Peekr's monthly active users and a transaction values Peekr at USD 10,000,000, then USD 5,000,000 shall be deemed attributable to {{country}}. The Partner shall be entitled to {{pctWords}} ({{pct}}%) of the value attributable to {{country}}, subject to the terms of this Agreement." },
  { t: "p", x: "If future investors, buyers or strategic partners require a different methodology, the Partner agrees that Peekr may negotiate and implement a reasonable alternative methodology, provided that the economic participation equal to {{pctWords}} ({{pct}}%) of the value attributable to {{country}} is preserved." },
  { t: "p", x: "Taxes, legal fees, investment banking fees, transaction costs and direct expenses related to such transaction may be deducted before calculating the distributable amounts." },

  { t: "h2", x: "7. DISTRIBUTION OF FUNDS" },
  { t: "p", x: "The Parties acknowledge that the Partner's participation rights entitle it to receive distributions only when cash, funds or other economic value are actually distributed to the holders of {{country}} Participation Rights." },
  { t: "p", x: "Accordingly, Peekr's mere receipt of investment capital, venture capital financing, strategic investment, convertible note, SAFE, debt financing or similar capital contributions shall not in itself constitute a distributable event." },
  { t: "p", x: "If funds received from investors remain within Peekr and are used for product development, operations, marketing, expansion, hiring, working capital, acquisitions, infrastructure, community growth or any other corporate purpose, such funds shall not be considered distributed funds and shall not give rise to any payment obligation to the Partner." },
  { t: "p", x: "The Partner shall participate only in actual distributions of economic value attributable to the {{country}} Participation Rights, including, without limitation: dividend distributions, profit distributions, sale proceeds distributed to participation holders, merger proceeds distributed to participation holders, acquisition proceeds distributed to participation holders, liquidity events resulting in cash distributions, and other distributions expressly declared by Peekr." },
  { t: "p", x: "Example: if Peekr receives a venture capital investment of USD 5,000,000 and all of the funds remain within the Company for growth and operations, no distribution shall be deemed to have occurred and no payment shall be owed to the Partner." },

  { t: "h2", x: "8. ACTIVE PARTICIPATION REQUIREMENTS" },
  { t: "p", x: "The Partner agrees to incorporate Peekr organically within its content ecosystem as a real tool for lists, ratings, recommendations and audience interaction. The Partner's active participation shall include:" },
  { t: "li", x: "Maintaining an active public account and profile on Peekr." },
  { t: "li", x: "Rating films and television content regularly within Peekr." },
  { t: "li", x: "Creating and maintaining public Peeklists and recommendations within the platform." },
  { t: "li", x: "Publicly using Peekr as part of its entertainment, recommendation and content workflow." },
  { t: "li", x: "Encouraging audience adoption and inviting its followers to follow the Partner's profile on Peekr." },
  { t: "li", x: "Maintaining a visible link to Peekr within its main bio link or link aggregator, subject to platform limitations and reasonable editorial flexibility." },
  { t: "li", x: "Organically mentioning Peekr in captions, YouTube videos, Instagram, TikTok, Facebook and other channels when it naturally makes sense within the context of the Partner's content." },
  { t: "li", x: "Supporting creator onboarding and strategic introductions with other relevant creators in {{country}} when reasonably possible." },
  { t: "li", x: "Participating in strategic conversations and providing feedback on product improvements, market opportunities and community growth." },

  { t: "h2", x: "9. CONTENT OBLIGATIONS" },
  { t: "p", x: "The Parties agree that the Partner's promotional obligations shall be primarily organic and integrated into the Partner's normal content flow, and not a rigid weekly volume obligation." },
  { t: "p", x: "The Partner's dedicated content obligation shall consist of one (1) Reel or promotional video dedicated to Peekr every three (3) months during the Term. Each dedicated Reel or video shall be intended to introduce Peekr to the audience, explain the platform's value for lists, ratings, recommendations, films and series, encourage downloads and user adoption, and invite the audience to follow the Partner's profile within Peekr." },
  { t: "p", x: "Each dedicated Reel or video shall be reasonably suitable for use in paid advertising, always subject to the Partner's prior approval for any paid media use pursuant to Clause 13." },
  { t: "p", x: "In addition to the quarterly dedicated Reel or video, the Partner shall organically incorporate Peekr within its ecosystem through use of the platform, Peeklists, ratings, recommendations, captions, video mentions and other references when it naturally makes sense. Such organic mentions shall not be treated as a rigid weekly volume obligation." },
  { t: "p", x: "The intent is for the Partner to genuinely incorporate Peekr within its creator ecosystem as a recurring reference tool for discovery, lists, ratings and recommendations of films and series." },

  { t: "h2", x: "10. PROFILE INTEGRATION" },
  { t: "p", x: "The Partner shall maintain a visible link to Peekr within its main bio link or link aggregator whenever reasonably possible, and shall encourage its followers to connect through Peekr and follow its profile within the platform." },

  { t: "h2", x: "11. STRATEGIC ADVISORY ROLE" },
  { t: "p", x: "The Partner shall act as an advisor with respect to:" },
  { t: "li", x: "Creator recruitment." },
  { t: "li", x: "Community growth." },
  { t: "li", x: "Market opportunities." },
  { t: "li", x: "Cultural adaptation." },
  { t: "li", x: "Strategic introductions." },
  { t: "li", x: "Product feedback." },
  { t: "li", x: "Entertainment ecosystem development." },

  { t: "h2", x: "12. DASHBOARD ACCESS, REPORTS AND AUDIT RIGHT" },
  { t: "p", x: "Peekr shall provide the Partner with access to a Growth Partner Dashboard, subject to technical availability and development priorities." },
  { t: "p", x: "Subject to availability, the Dashboard may include:" },
  { t: "li", x: "{{country}} MAU, WAU and DAU." },
  { t: "li", x: "Referral metrics." },
  { t: "li", x: "Content performance." },
  { t: "li", x: "Community growth." },
  { t: "li", x: "Engagement analytics." },
  { t: "li", x: "Revenue metrics attributable to {{country}}, when monetization is active and reasonably measurable." },
  { t: "p", x: "All Dashboard information shall constitute Confidential Information." },
  { t: "p", x: "Peekr shall provide the Partner with periodic reports regarding the {{country}} Participation Rights, whether through the Dashboard or through written reports, when monetization, distributions or liquidity events relevant to {{country}} occur." },
  { t: "p", x: "The Partner shall have a reasonable audit right over records directly related to the calculation of {{country}} Net Revenue or {{country}} Participation Rights, no more than once per calendar year, upon reasonable prior written notice, through an independent professional advisor subject to confidentiality. Any audit shall be conducted during normal business hours, in a manner that does not unreasonably interfere with Peekr's business operations, and shall be limited to the information reasonably necessary to verify the relevant calculations." },

  { t: "h2", x: "13. USE OF NAME, IMAGE AND LIKENESS; PAID MEDIA APPROVAL" },
  { t: "p", x: "The Partner grants Peekr a worldwide, royalty-free right to identify the Partner and its brand or company as FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}} and to use its name, image, voice, social handles, public content and testimonials in connection with marketing, advertising, investor presentations, public relations, business development and promotional campaigns related to Peekr, subject to the limitations set forth in this Clause." },
  { t: "p", x: "Any paid advertising, paid media campaign, boosted post, dark post, whitelisted advertisement, spark ad, creator ad or other paid promotional use involving the Partner's image, voice, profile, handle, content or likeness shall require the Partner's prior approval. Such approval shall include alignment on the final cut, copy, format, campaign context and usage period." },
  { t: "p", x: "The Partner's approval shall not be unreasonably withheld, conditioned or delayed, provided that the proposed use preserves the Partner's language, credibility, editorial style and positioning. Any broader commercial use, materially larger campaign, extended paid media use or materially different context shall be discussed and approved separately." },

  { t: "h2", x: "14. CONFIDENTIALITY" },
  { t: "p", x: "The Partner shall maintain strict confidentiality regarding: product roadmap, financial information, metrics, investor conversations, growth strategy, partnership conversations, technical information, Dashboard information and any other non-public information disclosed by Peekr." },
  { t: "p", x: "These obligations shall remain in effect during the Term and for two (2) years after termination." },

  { t: "h2", x: "15. EXCLUSIVITY AND LIMITED NON-COMPETE" },
  { t: "p", x: "During the Term, the Partner shall not promote, advise, invest in, act as an ambassador for, or publicly endorse any directly competing application or platform whose core business is substantially similar to Peekr's in the segment of social entertainment discovery, recommendation, rating, list-making, tracking, watchlist management or community interaction around films and television series." },
  { t: "p", x: "This exclusivity and limited non-compete shall apply only to direct competitors of Peekr and only during the Term. It shall not prevent the Partner from working with streaming platforms, production companies, distributors, festivals, brands, press, film, television, entertainment companies, media outlets or general entertainment campaigns, provided that such work does not involve the promotion or development of a directly competing application or platform as described above." },
  { t: "p", x: "The purpose of this clause is to protect Peekr's confidential information, internal strategy, product roadmap, metrics and growth plans so that they are not used, directly or indirectly, to support the development, promotion or growth of a competing application or platform." },

  { t: "h2", x: "16. EARLY EXIT, VESTING AND CLAWBACK" },
  { t: "p", x: "The participation granted under this Agreement is intended to compensate long-term contribution during the Initial Term." },
  { t: "p", x: "If the Partner voluntarily withdraws, abandons the alliance, materially breaches this Agreement or becomes inactive, and such situation is not cured within the applicable cure period set forth in Clause 18, the participation retained by the Partner shall be determined as follows:" },
  { t: "p", x: "Upon completing Year 1: the Partner permanently retains {{y1}}%." },
  { t: "p", x: "Upon completing Year 2: the Partner permanently retains {{y2}}%." },
  { t: "p", x: "Upon completing Year 3: the Partner permanently retains {{pct}}%." },
  { t: "p", x: "Any unvested or forfeited participation shall automatically revert to Peekr. There shall be no loss of participation due to ordinary delays, good-faith disagreements, reasonable editorial discretion or isolated breaches that are cured within the applicable cure period." },

  { t: "h2", x: "17. ABANDONMENT" },
  { t: "p", x: "The Partner shall be deemed inactive or to have abandoned the alliance if, after written notice and failure to cure within the applicable cure period, any of the following occurs:" },
  { t: "li", x: "There is no significant activity on Peekr for ninety (90) consecutive days." },
  { t: "li", x: "The Partner ceases public use of Peekr." },
  { t: "li", x: "The Partner ceases all reasonable integration of Peekr within its ecosystem." },
  { t: "li", x: "The Partner repeatedly fails to meet the quarterly dedicated content obligation." },
  { t: "li", x: "The Partner becomes unreachable for ninety (90) consecutive days." },

  { t: "h2", x: "18. NOTICE AND CURE PERIOD" },
  { t: "p", x: "Except for the Bad Actor Clause set forth in Clause 19 or other serious conduct causing material and immediate harm to Peekr, neither Party may declare material breach, inactivity, abandonment or loss of participation without first providing written notice describing the alleged breach in reasonable detail and granting the other Party sixty (60) days to cure such breach." },
  { t: "p", x: "If the breach is curable and is cured within such sixty (60) day period, there shall be no loss of participation or termination based on such breach. The Parties shall act in good faith to resolve operational, creative or performance matters before applying any loss of participation." },

  { t: "h2", x: "19. BAD ACTOR CLAUSE" },
  { t: "p", x: "Peekr may terminate this Agreement immediately, without a cure period, if the Partner engages in:" },
  { t: "li", x: "Fraud." },
  { t: "li", x: "Fake followers." },
  { t: "li", x: "Artificial engagement manipulation." },
  { t: "li", x: "Criminal conduct." },
  { t: "li", x: "Hate speech." },
  { t: "li", x: "Conduct materially harmful to Peekr's reputation." },
  { t: "li", x: "Intentional disclosure or misuse of Peekr's confidential information to build, support or promote a direct competitor." },

  { t: "h2", x: "20. TAXES" },
  { t: "p", x: "Each Party shall be solely responsible for its own tax obligations. Any withholding, governmental charge, bank fee, transaction cost or legally required deduction may be withheld before any distribution. The Partner shall be solely responsible for reporting and paying the applicable taxes in {{country}} or in any other applicable jurisdiction." },

  { t: "h2", x: "21. INDEPENDENT CONTRACTOR" },
  { t: "p", x: "Nothing in this Agreement shall create an employment relationship, partnership, joint venture or agency between the Parties." },

  { t: "h2", x: "22. GOVERNING LAW" },
  { t: "p", x: "This Agreement shall be governed by the laws of the Republic of Panama, given that EMANATION FILMS, INC. is a company incorporated under the laws of the Republic of Panama." },

  { t: "h2", x: "23. DISPUTE RESOLUTION" },
  { t: "p", x: "Any dispute arising out of this Agreement shall first be submitted to good-faith negotiation between the Parties." },
  { t: "p", x: "If the dispute is not resolved, it shall be submitted to binding arbitration in Panama City, Republic of Panama, unless the Parties mutually agree in writing on an alternative forum, mediation process or dispute resolution mechanism that is practical and balanced for both Parties." },

  { t: "h2", x: "24. ENTIRE AGREEMENT" },
  { t: "p", x: "This Agreement constitutes the entire agreement between the Parties and supersedes all prior discussions and communications." },
];

const TEMPLATE_PT: Block[] = [
  { t: "h1", x: "CONTRATO FOUNDING COUNTRY GROWTH PARTNER" },
  { t: "h1", x: "{{COUNTRY_UPPER}}" },
  { t: "p", x: "O presente Founding Country Growth Partner Agreement (o “Contrato”) é celebrado em {{effectiveDate}}, entre:" },
  { t: "p", x: "EMANATION FILMS, INC., sociedade constituída de acordo com as leis da República do Panamá, DUNS Number 727265117, proprietária e operadora da plataforma Peekr, representada por seu Representante Legal, JORGE ENRIQUE MARTINELLI REMOND, portador da identificação panamenha No. 8-713-1063 (doravante, “Peekr” ou a “Companhia”), e {{partnerName}}{{docId}}, atuando por meio de ou em nome de {{brandName}}, incluindo a marca, conta, presença pública e/ou ecossistema de redes sociais {{username}} (doravante, o “Partner”). A Peekr e o Partner poderão ser denominados individualmente como uma “Parte” e conjuntamente como as “Partes”." },

  { t: "h2", x: "1. OBJETO" },
  { t: "p", x: "O objeto deste Contrato é estabelecer uma aliança estratégica de longo prazo por meio da qual o Partner atuará como Founding Country Growth Partner para {{country}} e contribuirá ativamente para o crescimento, adoção, desenvolvimento do ecossistema de criadores e expansão da comunidade da Peekr dentro de {{country}}." },
  { t: "p", x: "As Partes reconhecem que esta relação vai além de uma campanha tradicional de influenciador e está concebida como uma colaboração estratégica focada em construir a comunidade {{countryAdj}} da Peekr." },

  { t: "h2", x: "2. DESIGNAÇÃO" },
  { t: "p", x: "A Peekr designa o Partner como: FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}}. O Partner aceita tal designação. As Partes reconhecem que a Peekr poderá designar outros criadores, influenciadores, embaixadores, consultores ou parceiros estratégicos dentro de {{country}}. O Partner concorda em apoiar ativamente o crescimento da comunidade e poderá colaborar na identificação, apresentação e desenvolvimento de relações com potenciais criadores, influenciadores, embaixadores e oportunidades estratégicas." },

  { t: "h2", x: "3. PRAZO" },
  { t: "p", x: "O prazo inicial deste Contrato será de três (3) anos contados a partir da Data de Vigência." },

  { t: "h2", x: "4. DIREITOS DE PARTICIPAÇÃO {{COUNTRY_UPPER}}" },
  { t: "p", x: "A partir da assinatura deste Contrato, o Partner será reconhecido como titular de direitos de participação econômica equivalentes a {{pctWords}} ({{pct}}%) dos Direitos de Participação {{country}}." },
  { t: "p", x: "Tais direitos são unicamente direitos contratuais de participação econômica e não constituem: participação acionária, ações, direitos de voto, direitos de conselho, direitos de governança corporativa, propriedade intelectual, direitos trabalhistas, participação societária nem relação de agência, salvo acordo escrito em contrário." },

  { t: "h2", x: "5. PARTICIPAÇÃO NA RECEITA OPERACIONAL" },
  { t: "p", x: "O Partner terá direito a {{pctWords}} ({{pct}}%) da Receita Líquida {{country}} atribuível aos Direitos de Participação {{country}}." },
  { t: "p", x: "A Receita Líquida {{country}} incluirá as receitas geradas em ou atribuíveis a {{country}} por: publicidade, sponsored discovery, affiliate marketing, assinaturas premium, licenciamento, alianças, APIs, produtos de dados, campanhas com criadores, campanhas de marca e futuras iniciativas de monetização." },
  { t: "p", x: "Antes de qualquer distribuição, a Peekr poderá deduzir: impostos aplicáveis, retenções, encargos bancários, comissões de processamento de pagamentos, custos de conversão de moeda, despesas diretas de transação e deduções legalmente exigidas. As despesas corporativas gerais, incluindo desenvolvimento de software, infraestrutura, funcionários, despesas operacionais e outros custos corporativos globais, não serão deduzidas dos Direitos de Participação {{country}}, salvo acordo escrito entre as Partes." },

  { t: "h2", x: "6. EVENTOS DE LIQUIDEZ" },
  { t: "p", x: "O Partner participará em aquisições, fusões, investimentos estratégicos, vendas de ações, vendas de ativos e outros eventos de liquidez que envolvam a Peekr, unicamente na medida em que tal evento resulte em fundos distribuíveis ou valor econômico efetivamente atribuível aos Direitos de Participação {{country}}." },
  { t: "p", x: "Para fins de determinação do valor atribuível a {{country}}, a metodologia base será: MAU {{country}} ÷ MAU Global, medido imediatamente antes da transação." },
  { t: "p", x: "Exemplo: se {{country}} representar cinquenta por cento (50%) dos usuários ativos mensais da Peekr e uma transação avaliar a Peekr em USD 10.000.000, então USD 5.000.000 serão considerados atribuíveis a {{country}}. O Partner terá direito a {{pctWords}} ({{pct}}%) do valor atribuível a {{country}}, sujeito aos termos deste Contrato." },
  { t: "p", x: "Se futuros investidores, compradores ou parceiros estratégicos exigirem uma metodologia diferente, o Partner concorda que a Peekr poderá negociar e implementar uma metodologia alternativa razoável, desde que se preserve a participação econômica equivalente a {{pctWords}} ({{pct}}%) do valor atribuível a {{country}}." },
  { t: "p", x: "Os impostos, honorários jurídicos, honorários de banco de investimento, custos de transação e despesas diretas relacionados a tal transação poderão ser deduzidos antes de calcular os montantes distribuíveis." },

  { t: "h2", x: "7. DISTRIBUIÇÃO DE FUNDOS" },
  { t: "p", x: "As Partes reconhecem que os direitos de participação do Partner lhe conferem o direito de receber distribuições unicamente quando dinheiro, fundos ou outro valor econômico forem efetivamente distribuídos aos titulares de Direitos de Participação {{country}}." },
  { t: "p", x: "Consequentemente, o mero recebimento pela Peekr de capital de investimento, financiamento de venture capital, investimento estratégico, nota conversível, SAFE, financiamento de dívida ou aportes de capital similares não constituirá por si só um evento distribuível." },
  { t: "p", x: "Se os fundos recebidos de investidores permanecerem dentro da Peekr e forem utilizados para desenvolvimento de produto, operações, marketing, expansão, contratações, capital de giro, aquisições, infraestrutura, crescimento de comunidade ou qualquer outro propósito corporativo, tais fundos não serão considerados fundos distribuídos e não gerarão obrigação de pagamento ao Partner." },
  { t: "p", x: "O Partner participará unicamente em distribuições reais de valor econômico atribuível aos Direitos de Participação {{country}}, incluindo, sem limitação: distribuições de dividendos, distribuições de lucros, fundos de venda distribuídos aos titulares de participação, fundos de fusão distribuídos aos titulares de participação, fundos de aquisição distribuídos aos titulares de participação, eventos de liquidez que resultem em distribuições de dinheiro e outras distribuições expressamente declaradas pela Peekr." },
  { t: "p", x: "Exemplo: se a Peekr receber um investimento de venture capital de USD 5.000.000 e a totalidade dos fundos permanecer dentro da Companhia para crescimento e operações, não se considerará que ocorreu uma distribuição e nenhum pagamento será devido ao Partner." },

  { t: "h2", x: "8. REQUISITOS DE PARTICIPAÇÃO ATIVA" },
  { t: "p", x: "O Partner concorda em incorporar a Peekr de forma orgânica dentro de seu ecossistema de conteúdo como uma ferramenta real para listas, avaliações, recomendações e interação com sua audiência. A participação ativa do Partner incluirá:" },
  { t: "li", x: "Manter uma conta e perfil público ativo na Peekr." },
  { t: "li", x: "Avaliar filmes e conteúdo de televisão regularmente dentro da Peekr." },
  { t: "li", x: "Criar e manter Peeklists públicas e recomendações dentro da plataforma." },
  { t: "li", x: "Usar a Peekr publicamente como parte de seu fluxo de trabalho de entretenimento, recomendações e conteúdo." },
  { t: "li", x: "Fomentar a adoção por parte da audiência e convidar seus seguidores a seguir o perfil do Partner na Peekr." },
  { t: "li", x: "Manter um link visível para a Peekr dentro de seu link principal de bio ou agregador de links, sujeito a limitações de plataforma e flexibilidade editorial razoável." },
  { t: "li", x: "Mencionar a Peekr de forma orgânica em legendas, vídeos do YouTube, Instagram, TikTok, Facebook e outros canais quando naturalmente fizer sentido dentro do contexto do conteúdo do Partner." },
  { t: "li", x: "Apoiar o onboarding de criadores e apresentações estratégicas com outros criadores relevantes em {{country}} quando razoavelmente possível." },
  { t: "li", x: "Participar de conversas estratégicas e fornecer feedback sobre melhorias de produto, oportunidades de mercado e crescimento de comunidade." },

  { t: "h2", x: "9. OBRIGAÇÕES DE CONTEÚDO" },
  { t: "p", x: "As Partes acordam que as obrigações promocionais do Partner serão principalmente orgânicas e integradas ao fluxo normal de conteúdo do Partner, e não uma obrigação rígida de volume semanal." },
  { t: "p", x: "A obrigação de conteúdo dedicado do Partner consistirá em um (1) Reel ou vídeo promocional dedicado à Peekr a cada três (3) meses durante o Prazo. Cada Reel ou vídeo dedicado terá como finalidade apresentar a Peekr ao público, explicar o valor da plataforma para listas, avaliações, recomendações, filmes e séries, incentivar downloads e adoção de usuários, e convidar a audiência a seguir o perfil do Partner dentro da Peekr." },
  { t: "p", x: "Cada Reel ou vídeo dedicado deverá ser razoavelmente apto para uso em publicidade paga, sempre sujeito à aprovação prévia do Partner para qualquer uso em mídia paga conforme a Cláusula 13." },
  { t: "p", x: "Além do Reel ou vídeo dedicado trimestral, o Partner incorporará organicamente a Peekr dentro de seu ecossistema mediante o uso da plataforma, Peeklists, avaliações, recomendações, legendas, menções em vídeos e outras referências quando naturalmente fizer sentido. Tais menções orgânicas não serão tratadas como uma obrigação rígida de volume semanal." },
  { t: "p", x: "A intenção é que o Partner incorpore genuinamente a Peekr dentro de seu ecossistema de criador como uma ferramenta recorrente de referência para descoberta, listas, avaliações e recomendações de filmes e séries." },

  { t: "h2", x: "10. INTEGRAÇÃO NO PERFIL" },
  { t: "p", x: "O Partner manterá um link visível para a Peekr dentro de seu link principal de bio ou agregador de links sempre que razoavelmente possível, e incentivará seus seguidores a se conectarem através da Peekr e seguirem seu perfil dentro da plataforma." },

  { t: "h2", x: "11. PAPEL DE CONSULTORIA ESTRATÉGICA" },
  { t: "p", x: "O Partner atuará como consultor com relação a:" },
  { t: "li", x: "Recrutamento de criadores." },
  { t: "li", x: "Crescimento de comunidade." },
  { t: "li", x: "Oportunidades de mercado." },
  { t: "li", x: "Adaptação cultural." },
  { t: "li", x: "Apresentações estratégicas." },
  { t: "li", x: "Feedback de produto." },
  { t: "li", x: "Desenvolvimento do ecossistema de entretenimento." },

  { t: "h2", x: "12. ACESSO A DASHBOARD, RELATÓRIOS E DIREITO DE AUDITORIA" },
  { t: "p", x: "A Peekr proporcionará ao Partner acesso a um Growth Partner Dashboard, sujeito à disponibilidade técnica e prioridades de desenvolvimento." },
  { t: "p", x: "Sujeito à disponibilidade, o Dashboard poderá incluir:" },
  { t: "li", x: "MAU, WAU e DAU de {{country}}." },
  { t: "li", x: "Métricas de indicações." },
  { t: "li", x: "Performance de conteúdo." },
  { t: "li", x: "Crescimento de comunidade." },
  { t: "li", x: "Analítica de engajamento." },
  { t: "li", x: "Métricas de receita atribuíveis a {{country}}, quando a monetização estiver ativa e for razoavelmente mensurável." },
  { t: "p", x: "Toda a informação do Dashboard constituirá Informação Confidencial." },
  { t: "p", x: "A Peekr proporcionará ao Partner relatórios periódicos com relação aos Direitos de Participação {{country}}, seja mediante o Dashboard ou mediante relatórios escritos, quando ocorrerem monetização, distribuições ou eventos de liquidez relevantes para {{country}}." },
  { t: "p", x: "O Partner terá um direito razoável de auditoria sobre registros diretamente relacionados ao cálculo da Receita Líquida {{country}} ou dos Direitos de Participação {{country}}, não mais de uma vez por ano civil, mediante notificação escrita prévia razoável, através de um consultor profissional independente sujeito a confidencialidade. Toda auditoria será realizada em horário comercial normal, de maneira que não interfira irrazoavelmente com as operações comerciais da Peekr e se limitará à informação razoavelmente necessária para verificar os cálculos correspondentes." },

  { t: "h2", x: "13. USO DE NOME, IMAGEM E SEMELHANÇA; APROVAÇÃO DE MÍDIA PAGA" },
  { t: "p", x: "O Partner outorga à Peekr um direito mundial, livre de royalties, para identificar o Partner e sua marca ou empresa como FOUNDING COUNTRY GROWTH PARTNER – {{COUNTRY_UPPER}} e para usar seu nome, imagem, voz, handles sociais, conteúdo público e depoimentos em relação a marketing, publicidade, apresentações a investidores, relações públicas, desenvolvimento comercial e campanhas promocionais relacionadas à Peekr, sujeito às limitações estabelecidas nesta Cláusula." },
  { t: "p", x: "Qualquer publicidade paga, campanha de mídia paga, publicação impulsionada, dark post, whitelisted advertisement, spark ad, creator ad ou outro uso promocional pago que envolva a imagem, voz, perfil, handle, conteúdo ou semelhança do Partner exigirá aprovação prévia do Partner. Tal aprovação incluirá alinhamento sobre o corte final, texto, formato, contexto de campanha e período de uso." },
  { t: "p", x: "A aprovação do Partner não será irrazoavelmente negada, condicionada ou demorada, desde que o uso proposto preserve a linguagem, credibilidade, estilo editorial e posicionamento do Partner. Qualquer uso comercial mais amplo, campanha materialmente maior, uso estendido em mídia paga ou contexto materialmente diferente deverá ser conversado e aprovado separadamente." },

  { t: "h2", x: "14. CONFIDENCIALIDADE" },
  { t: "p", x: "O Partner manterá estrita confidencialidade com relação a: roadmap de produto, informação financeira, métricas, conversas com investidores, estratégia de crescimento, conversas de alianças, informação técnica, informação do Dashboard e qualquer outra informação não pública divulgada pela Peekr." },
  { t: "p", x: "Estas obrigações permanecerão vigentes durante o Prazo e por dois (2) anos posteriores à rescisão." },

  { t: "h2", x: "15. EXCLUSIVIDADE E NÃO CONCORRÊNCIA LIMITADA" },
  { t: "p", x: "Durante o Prazo, o Partner não promoverá, assessorará, investirá, atuará como embaixador nem endossará publicamente nenhuma aplicação ou plataforma diretamente concorrente cujo negócio principal seja substancialmente similar ao da Peekr no segmento de descoberta social de entretenimento, recomendação, avaliação, criação de listas, acompanhamento, gestão de watchlist ou interação comunitária sobre filmes e séries de televisão." },
  { t: "p", x: "Esta exclusividade e não concorrência limitada aplicar-se-á unicamente a concorrentes diretos da Peekr e somente durante o Prazo. Não impedirá o Partner de trabalhar com plataformas de streaming, produtoras, distribuidoras, festivais, marcas, imprensa, cinema, televisão, empresas de entretenimento, meios de comunicação ou campanhas gerais de entretenimento, desde que tal trabalho não envolva a promoção ou desenvolvimento de uma aplicação ou plataforma diretamente concorrente conforme descrito acima." },
  { t: "p", x: "O propósito desta cláusula é proteger a informação confidencial, estratégia interna, roadmap de produto, métricas e planos de crescimento da Peekr para que não sejam utilizados, direta ou indiretamente, para apoiar o desenvolvimento, promoção ou crescimento de uma aplicação ou plataforma concorrente." },

  { t: "h2", x: "16. SAÍDA ANTECIPADA, VESTING E CLAWBACK" },
  { t: "p", x: "A participação outorgada neste Contrato tem por objeto compensar a contribuição de longo prazo durante o Prazo Inicial." },
  { t: "p", x: "Se o Partner se retirar voluntariamente, abandonar a aliança, descumprir materialmente este Contrato ou se tornar inativo, e tal situação não for sanada dentro do período de cura aplicável estabelecido na Cláusula 18, a participação retida pelo Partner será determinada da seguinte forma:" },
  { t: "p", x: "Após completar o Ano 1: o Partner retém permanentemente {{y1}}%." },
  { t: "p", x: "Após completar o Ano 2: o Partner retém permanentemente {{y2}}%." },
  { t: "p", x: "Após completar o Ano 3: o Partner retém permanentemente {{pct}}%." },
  { t: "p", x: "Qualquer participação não consolidada ou perdida reverterá automaticamente à Peekr. Não haverá perda de participação por demoras ordinárias, desacordos de boa-fé, discrição editorial razoável ou descumprimentos isolados que sejam sanados dentro do período de cura aplicável." },

  { t: "h2", x: "17. ABANDONO" },
  { t: "p", x: "Considerar-se-á que o Partner está inativo ou abandonou a aliança se, após notificação escrita e falta de saneamento dentro do período de cura aplicável, ocorrer qualquer uma das seguintes situações:" },
  { t: "li", x: "Não há atividade significativa na Peekr durante noventa (90) dias consecutivos." },
  { t: "li", x: "O Partner cessa o uso público da Peekr." },
  { t: "li", x: "O Partner cessa toda integração razoável da Peekr dentro de seu ecossistema." },
  { t: "li", x: "O Partner descumpre repetidamente a obrigação de conteúdo trimestral dedicado." },
  { t: "li", x: "O Partner se torna inalcançável durante noventa (90) dias consecutivos." },

  { t: "h2", x: "18. NOTIFICAÇÃO E PERÍODO DE CURA" },
  { t: "p", x: "Salvo pela Cláusula de Bad Actor estabelecida na Cláusula 19 ou outra conduta grave que cause dano material e imediato à Peekr, nenhuma Parte poderá declarar descumprimento material, inatividade, abandono ou perda de participação sem antes fornecer notificação escrita descrevendo o suposto descumprimento com detalhe razoável e concedendo à outra Parte sessenta (60) dias para sanar tal descumprimento." },
  { t: "p", x: "Se o descumprimento for suscetível de saneamento e for sanado dentro de tal período de sessenta (60) dias, não haverá perda de participação nem rescisão baseada em tal descumprimento. As Partes atuarão de boa-fé para resolver questões operacionais, criativas ou de desempenho antes de aplicar qualquer perda de participação." },

  { t: "h2", x: "19. CLÁUSULA DE BAD ACTOR" },
  { t: "p", x: "A Peekr poderá rescindir este Contrato imediatamente, sem período de cura, se o Partner incorrer em:" },
  { t: "li", x: "Fraude." },
  { t: "li", x: "Seguidores falsos." },
  { t: "li", x: "Manipulação artificial de engajamento." },
  { t: "li", x: "Conduta criminosa." },
  { t: "li", x: "Discurso de ódio." },
  { t: "li", x: "Conduta materialmente prejudicial à reputação da Peekr." },
  { t: "li", x: "Divulgação ou uso indevido intencional de informação confidencial da Peekr para construir, apoiar ou promover um concorrente direto." },

  { t: "h2", x: "20. IMPOSTOS" },
  { t: "p", x: "Cada Parte será exclusivamente responsável por suas próprias obrigações fiscais. Qualquer retenção, encargo governamental, comissão bancária, custo de transação ou dedução legalmente exigida poderá ser retida antes de qualquer distribuição. O Partner será exclusivamente responsável por declarar e pagar os impostos correspondentes em {{country}} ou em qualquer outra jurisdição aplicável." },

  { t: "h2", x: "21. CONTRATANTE INDEPENDENTE" },
  { t: "p", x: "Nada neste Contrato criará uma relação trabalhista, sociedade, joint venture ou agência entre as Partes." },

  { t: "h2", x: "22. LEI APLICÁVEL" },
  { t: "p", x: "Este Contrato será regido pelas leis da República do Panamá, dado que a EMANATION FILMS, INC. é uma sociedade constituída de acordo com as leis da República do Panamá." },

  { t: "h2", x: "23. RESOLUÇÃO DE DISPUTAS" },
  { t: "p", x: "Qualquer disputa decorrente deste Contrato será submetida primeiro a negociação de boa-fé entre as Partes." },
  { t: "p", x: "Se a disputa não for resolvida, será submetida a arbitragem vinculante na Cidade do Panamá, República do Panamá, salvo que as Partes acordem mutuamente por escrito um foro alternativo, processo de mediação ou mecanismo de resolução de disputas que seja prático e equilibrado para ambas as Partes." },

  { t: "h2", x: "24. ACORDO COMPLETO" },
  { t: "p", x: "Este Contrato constitui o acordo completo entre as Partes e substitui todas as conversas e comunicações prévias." },
];

const TEMPLATES: Record<Lang, Block[]> = {
  es: TEMPLATE_ES,
  en: TEMPLATE_EN,
  pt: TEMPLATE_PT,
};

export function fillContract(f: ContractFields): Block[] {
  const lang: Lang = f.language ?? "es";
  const pct = f.percentage;
  const y1 = fmtPct(Math.round((pct / 3) * 100) / 100);
  const y2 = fmtPct(Math.round(((pct * 2) / 3) * 100) / 100);
  const docNum = (f.docNumber ?? "").trim();
  const docCty = (f.docCountry ?? "").trim();
  const map: Record<string, string> = {
    docId: docId(docNum, docCty, lang),
    country: f.country,
    COUNTRY_UPPER: f.country.toUpperCase(),
    countryAdj: countryAdj(f.country, lang),
    effectiveDate: f.effectiveDate,
    partnerName: f.partnerName,
    brandName: f.brandName || f.partnerName,
    username: f.username,
    pct: fmtPct(pct),
    pctWords: pctWords(pct, lang),
    y1,
    y2,
  };
  const sub = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
  return TEMPLATES[lang].map((b) => ({ ...b, x: sub(b.x) }));
}
