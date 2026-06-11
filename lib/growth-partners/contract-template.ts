// Founding Country Growth Partner Agreement — structured template.
// Text is verbatim from the source Word doc; per-partner values are injected
// via {{placeholders}}. Rendered to PDF by ContractPdf.tsx.

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
};

const PCT_WORDS: Record<string, string> = {
  "1": "uno por ciento",
  "2": "dos por ciento",
  "3": "tres por ciento",
  "4": "cuatro por ciento",
  "5": "cinco por ciento",
  "6": "seis por ciento",
  "7": "siete por ciento",
  "8": "ocho por ciento",
  "9": "nueve por ciento",
  "10": "diez por ciento",
};

function pctWords(p: number): string {
  return PCT_WORDS[String(p)] ?? `${p} por ciento`;
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// The agreement body, with {{tokens}}. One entry per paragraph/heading/bullet.
const TEMPLATE: Block[] = [
  { t: "h1", x: "ACUERDO FOUNDING COUNTRY GROWTH PARTNER" },
  { t: "h1", x: "{{COUNTRY_UPPER}}" },
  { t: "p", x: "El presente Founding Country Growth Partner Agreement (el “Acuerdo”) se celebra con fecha {{effectiveDate}}, entre:" },
  { t: "p", x: "EMANATION FILMS, INC., una sociedad constituida conforme a las leyes de la República de Panamá, DUNS Number 727265117, propietaria y operadora de la plataforma Peekr, representada por su Representante Legal, JORGE ENRIQUE MARTINELLI REMOND, con identificación panameña No. 8-713-1063 (en adelante, “Peekr” o la “Compañía”), y {{partnerName}}, actuando a través de o en nombre de {{brandName}}, incluyendo la marca, cuenta, presencia pública y/o ecosistema de redes sociales {{username}} (en adelante, el “Partner”). Peekr y el Partner podrán ser denominados individualmente como una “Parte” y conjuntamente como las “Partes”." },

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

// Country adjective (community "argentina", "panameña", etc.) — best effort;
// falls back to "de {country}".
const COUNTRY_ADJ: Record<string, string> = {
  Argentina: "argentina",
  Panamá: "panameña",
  México: "mexicana",
  Colombia: "colombiana",
  Chile: "chilena",
  "Perú": "peruana",
  Brasil: "brasileña",
  España: "española",
};

export function fillContract(f: ContractFields): Block[] {
  const pct = f.percentage;
  const y1 = fmtPct(Math.round((pct / 3) * 100) / 100);
  const y2 = fmtPct(Math.round(((pct * 2) / 3) * 100) / 100);
  const adj = COUNTRY_ADJ[f.country] ?? `de ${f.country}`;
  const map: Record<string, string> = {
    country: f.country,
    COUNTRY_UPPER: f.country.toUpperCase(),
    countryAdj: adj,
    effectiveDate: f.effectiveDate,
    partnerName: f.partnerName,
    brandName: f.brandName || f.partnerName,
    username: f.username,
    pct: fmtPct(pct),
    pctWords: pctWords(pct),
    y1,
    y2,
  };
  const sub = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
  return TEMPLATE.map((b) => ({ ...b, x: sub(b.x) }));
}
