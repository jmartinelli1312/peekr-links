export const dynamic = "force-dynamic";

import { cookies } from "next/headers";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export async function generateMetadata() {
  return {
    title: "Terms of Service | Peekr",
    description:
      "Terms of Service for Peekr, owned and operated by Emanation Films, Inc.",
    alternates: {
      canonical: "https://www.peekr.app/terms",
    },
    openGraph: {
      title: "Terms of Service | Peekr",
      description:
        "Terms of Service for Peekr, owned and operated by Emanation Films, Inc.",
      url: "https://www.peekr.app/terms",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Terms of Service | Peekr",
      description:
        "Terms of Service for Peekr, owned and operated by Emanation Films, Inc.",
    },
  };
}

export default async function TermsPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Terms of Service",
      title: "Terms of Service",
      updated: "Last updated",
      date: "March 18, 2026",
      intro:
        "These Terms of Service govern your access to and use of the Peekr website, mobile app, and related services. Peekr is owned and operated by Emanation Films, Inc. By accessing or using Peekr, you agree to these Terms.",
      sections: [
        {
          title: "1. Acceptance of the Terms",
          body: [
            "By accessing, browsing, registering for, or using Peekr, you agree to be bound by these Terms of Service and by our Privacy Policy.",
            "If you do not agree with these Terms, you must not use Peekr.",
          ],
        },
        {
          title: "2. Who operates Peekr",
          body: [
            "Peekr is owned and operated by Emanation Films, Inc. Throughout these Terms, “Peekr,” “we,” “us,” and “our” refer to Emanation Films, Inc. and the Peekr service.",
          ],
        },
        {
          title: "3. Eligibility and accounts",
          body: [
            "You may use Peekr only if you are legally able to enter into a binding agreement under applicable law.",
            "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
            "You agree to provide accurate information and to keep your account information reasonably up to date.",
          ],
        },
        {
          title: "4. Your use of the service",
          body: [
            "Peekr is a social platform for movies and series that allows users to track watch activity, publish ratings and comments, create lists, discover titles and people, and interact with other users.",
            "You may use Peekr only for lawful purposes and in accordance with these Terms.",
          ],
        },
        {
          title: "5. User content",
          body: [
            "You may submit or publish content through Peekr, including ratings, comments, profile information, lists, and other user-generated content.",
            "You retain ownership of the content you create, but by submitting content to Peekr, you grant us a worldwide, non-exclusive, royalty-free, sublicensable license to host, store, reproduce, adapt, display, distribute, and otherwise use that content as necessary to operate, promote, improve, and provide the service.",
            "You represent and warrant that you have the rights necessary to submit the content and to grant the rights described above.",
          ],
        },
        {
          title: "6. Public and social features",
          body: [
            "Peekr includes social and public-facing features. Depending on product design and account settings, your username, profile image, ratings, comments, lists, follows, and watch activity may be visible to other users or to the public.",
            "You are responsible for the content you choose to make available through the service.",
          ],
        },
        {
          title: "7. Prohibited conduct",
          body: [
            "You agree not to use Peekr to violate any law, infringe the rights of others, harass or threaten others, impersonate any person, submit unlawful or harmful content, attempt unauthorized access, interfere with the service, scrape or copy the service in an abusive manner, distribute malware, or engage in fraudulent, deceptive, or abusive behavior.",
            "We may investigate and take action against behavior that we believe violates these Terms or threatens the safety, integrity, or operation of Peekr.",
          ],
        },
        {
          title: "8. Third-party content and services",
          body: [
            "Peekr may display or rely on content, metadata, links, and services provided by third parties, including movie, television, cast, crew, awards, platform, and related entertainment data sources.",
            "We are not responsible for third-party websites, services, or content, and your use of those third-party services may be subject to their own terms and policies.",
          ],
        },
        {
          title: "9. Intellectual property",
          body: [
            "Except for user content and third-party content made available under applicable rights, Peekr and its service, software, design, branding, text, graphics, and related materials are owned by or licensed to Emanation Films, Inc. and are protected by intellectual property laws.",
            "You may not copy, reproduce, modify, distribute, create derivative works from, reverse engineer, or exploit the service except as expressly permitted by law or by us in writing.",
          ],
        },
        {
          title: "10. Suspension and termination",
          body: [
            "We may suspend, restrict, or terminate your access to Peekr at any time, with or without notice, if we believe you have violated these Terms, created legal risk, harmed other users, or threatened the integrity or operation of the service.",
            "You may stop using the service at any time. Certain provisions of these Terms will survive termination by their nature.",
          ],
        },
        {
          title: "11. Availability and changes",
          body: [
            "We may modify, suspend, or discontinue any part of Peekr at any time. We do not guarantee that the service will always be available, uninterrupted, secure, or error-free.",
            "We may also update these Terms from time to time. When we do, we may revise the effective date and, where appropriate, provide additional notice.",
          ],
        },
        {
          title: "12. Disclaimers",
          body: [
            "Peekr is provided on an “as is” and “as available” basis to the fullest extent permitted by law. We disclaim warranties of any kind, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, and availability.",
            "We do not guarantee the accuracy, completeness, or reliability of third-party content, metadata, recommendations, or user-generated content.",
          ],
        },
        {
          title: "13. Limitation of liability",
          body: [
            "To the fullest extent permitted by law, Emanation Films, Inc. and its affiliates, officers, directors, employees, contractors, licensors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, goodwill, or business opportunities arising out of or related to your use of Peekr.",
            "To the fullest extent permitted by law, our total liability for any claim arising out of or relating to Peekr will not exceed the greater of the amount you paid us, if any, in the twelve months before the claim, or one hundred U.S. dollars (US$100).",
          ],
        },
        {
          title: "14. Indemnity",
          body: [
            "You agree to indemnify, defend, and hold harmless Emanation Films, Inc. and its affiliates, officers, directors, employees, contractors, licensors, and service providers from and against claims, liabilities, damages, losses, and expenses arising out of or related to your content, your use of Peekr, your violation of these Terms, or your violation of the rights of any third party.",
          ],
        },
        {
          title: "15. Governing law",
          body: [
            "These Terms are governed by and interpreted in accordance with the laws applicable to Emanation Films, Inc., without regard to conflict of law principles, except where mandatory local law provides otherwise.",
            "Any dispute arising out of or relating to these Terms or to Peekr will be subject to the jurisdiction and venue permitted by applicable law.",
          ],
        },
        {
          title: "16. Contact",
          body: [
            "Peekr is owned and operated by Emanation Films, Inc.",
            "For support, legal requests, or questions about these Terms, contact: info@peekr.app.",
            "Website: https://www.peekr.app",
          ],
        },
      ],
    },
    es: {
      eyebrow: "Términos del Servicio",
      title: "Términos del Servicio",
      updated: "Última actualización",
      date: "18 de marzo de 2026",
      intro:
        "Estos Términos del Servicio regulan su acceso y uso del sitio web de Peekr, su app móvil y servicios relacionados. Peekr es propiedad y es operada por Emanation Films, Inc. Al acceder o utilizar Peekr, usted acepta estos Términos.",
      sections: [
        {
          title: "1. Aceptación de los Términos",
          body: [
            "Al acceder, navegar, registrarse o utilizar Peekr, usted acepta quedar obligado por estos Términos del Servicio y por nuestra Política de Privacidad.",
            "Si no está de acuerdo con estos Términos, no debe utilizar Peekr.",
          ],
        },
        {
          title: "2. Quién opera Peekr",
          body: [
            "Peekr es propiedad y es operada por Emanation Films, Inc. En estos Términos, “Peekr”, “nosotros” y “nuestro” se refieren a Emanation Films, Inc. y al servicio Peekr.",
          ],
        },
        {
          title: "3. Elegibilidad y cuentas",
          body: [
            "Usted solo puede usar Peekr si tiene capacidad legal para celebrar un acuerdo vinculante bajo la ley aplicable.",
            "Usted es responsable de mantener la confidencialidad de sus credenciales de cuenta y de todas las actividades que ocurran bajo su cuenta.",
            "Usted acepta proporcionar información precisa y mantener su información de cuenta razonablemente actualizada.",
          ],
        },
        {
          title: "4. Uso del servicio",
          body: [
            "Peekr es una plataforma social para películas y series que permite a los usuarios registrar actividad de visualización, publicar ratings y comentarios, crear listas, descubrir títulos y personas e interactuar con otros usuarios.",
            "Usted solo puede usar Peekr con fines lícitos y de conformidad con estos Términos.",
          ],
        },
        {
          title: "5. Contenido del usuario",
          body: [
            "Usted puede enviar o publicar contenido a través de Peekr, incluyendo ratings, comentarios, información de perfil, listas y otro contenido generado por usuarios.",
            "Usted conserva la propiedad del contenido que crea, pero al enviar contenido a Peekr, nos otorga una licencia mundial, no exclusiva, libre de regalías y sublicenciable para alojar, almacenar, reproducir, adaptar, mostrar, distribuir y utilizar de otra manera dicho contenido según sea necesario para operar, promover, mejorar y prestar el servicio.",
            "Usted declara y garantiza que tiene los derechos necesarios para enviar el contenido y otorgar los derechos descritos anteriormente.",
          ],
        },
        {
          title: "6. Funciones públicas y sociales",
          body: [
            "Peekr incluye funciones sociales y visibles públicamente. Dependiendo del diseño del producto y de la configuración de su cuenta, su nombre de usuario, imagen de perfil, ratings, comentarios, listas, follows y actividad de visualización pueden ser visibles para otros usuarios o para el público.",
            "Usted es responsable del contenido que elija poner a disposición a través del servicio.",
          ],
        },
        {
          title: "7. Conducta prohibida",
          body: [
            "Usted acepta no usar Peekr para violar ninguna ley, infringir derechos de terceros, acosar o amenazar a otros, hacerse pasar por otra persona, enviar contenido ilegal o dañino, intentar acceso no autorizado, interferir con el servicio, hacer scraping o copiar el servicio de forma abusiva, distribuir malware o participar en conducta fraudulenta, engañosa o abusiva.",
            "Podemos investigar y tomar medidas frente a conductas que consideremos violatorias de estos Términos o que amenacen la seguridad, integridad u operación de Peekr.",
          ],
        },
        {
          title: "8. Contenido y servicios de terceros",
          body: [
            "Peekr puede mostrar o basarse en contenido, metadata, enlaces y servicios proporcionados por terceros, incluyendo fuentes de datos sobre películas, series, cast, crew, premios, plataformas y entretenimiento relacionado.",
            "No somos responsables por sitios web, servicios o contenido de terceros, y su uso de dichos servicios puede estar sujeto a sus propios términos y políticas.",
          ],
        },
        {
          title: "9. Propiedad intelectual",
          body: [
            "Salvo por el contenido del usuario y el contenido de terceros disponible bajo derechos aplicables, Peekr y su servicio, software, diseño, marca, textos, gráficos y materiales relacionados son propiedad de Emanation Films, Inc. o están licenciados a su favor, y están protegidos por leyes de propiedad intelectual.",
            "Usted no puede copiar, reproducir, modificar, distribuir, crear obras derivadas, realizar ingeniería inversa o explotar el servicio salvo que la ley lo permita expresamente o que nosotros lo autoricemos por escrito.",
          ],
        },
        {
          title: "10. Suspensión y terminación",
          body: [
            "Podemos suspender, restringir o terminar su acceso a Peekr en cualquier momento, con o sin aviso, si consideramos que usted ha violado estos Términos, ha generado riesgo legal, ha perjudicado a otros usuarios o ha amenazado la integridad u operación del servicio.",
            "Usted puede dejar de usar el servicio en cualquier momento. Ciertas disposiciones de estos Términos sobrevivirán a la terminación por su propia naturaleza.",
          ],
        },
        {
          title: "11. Disponibilidad y cambios",
          body: [
            "Podemos modificar, suspender o descontinuar cualquier parte de Peekr en cualquier momento. No garantizamos que el servicio esté siempre disponible, sea ininterrumpido, seguro o libre de errores.",
            "También podemos actualizar estos Términos ocasionalmente. Cuando lo hagamos, podremos revisar la fecha de vigencia y, cuando corresponda, proporcionar aviso adicional.",
          ],
        },
        {
          title: "12. Exclusión de garantías",
          body: [
            "Peekr se proporciona “tal cual” y “según disponibilidad” en la máxima medida permitida por la ley. Renunciamos a garantías de cualquier tipo, ya sean expresas, implícitas o legales, incluyendo garantías de comerciabilidad, idoneidad para un fin particular, no infracción y disponibilidad.",
            "No garantizamos la exactitud, integridad o confiabilidad del contenido de terceros, metadata, recomendaciones o contenido generado por usuarios.",
          ],
        },
        {
          title: "13. Limitación de responsabilidad",
          body: [
            "En la máxima medida permitida por la ley, Emanation Films, Inc. y sus afiliadas, directores, funcionarios, empleados, contratistas, licenciantes y proveedores no serán responsables por daños indirectos, incidentales, especiales, consecuenciales, ejemplares o punitivos, ni por pérdida de ganancias, datos, goodwill u oportunidades comerciales derivadas o relacionadas con su uso de Peekr.",
            "En la máxima medida permitida por la ley, nuestra responsabilidad total por cualquier reclamación derivada de o relacionada con Peekr no excederá el mayor entre el monto que usted nos haya pagado, si existiera, en los doce meses anteriores a la reclamación, o cien dólares estadounidenses (US$100).",
          ],
        },
        {
          title: "14. Indemnización",
          body: [
            "Usted acepta indemnizar, defender y mantener indemne a Emanation Films, Inc. y sus afiliadas, directores, funcionarios, empleados, contratistas, licenciantes y proveedores frente a reclamaciones, responsabilidades, daños, pérdidas y gastos derivados de o relacionados con su contenido, su uso de Peekr, su violación de estos Términos o la violación de derechos de terceros.",
          ],
        },
        {
          title: "15. Ley aplicable",
          body: [
            "Estos Términos se rigen e interpretan conforme a las leyes aplicables a Emanation Films, Inc., sin perjuicio de principios de conflicto de leyes, salvo que una ley local obligatoria disponga lo contrario.",
            "Toda disputa derivada de o relacionada con estos Términos o con Peekr estará sujeta a la jurisdicción y competencia permitidas por la ley aplicable.",
          ],
        },
        {
          title: "16. Contacto",
          body: [
            "Peekr es propiedad y es operada por Emanation Films, Inc.",
            "Para soporte, solicitudes legales o preguntas sobre estos Términos, contacte a: info@peekr.app.",
            "Sitio web: https://www.peekr.app",
          ],
        },
      ],
    },
    pt: {
      eyebrow: "Termos de Serviço",
      title: "Termos de Serviço",
      updated: "Última atualização",
      date: "18 de março de 2026",
      intro:
        "Estes Termos de Serviço regem seu acesso e uso do site do Peekr, do aplicativo móvel e de serviços relacionados. O Peekr é de propriedade e operado por Emanation Films, Inc. Ao acessar ou usar o Peekr, você concorda com estes Termos.",
      sections: [
        {
          title: "1. Aceitação dos Termos",
          body: [
            "Ao acessar, navegar, registrar-se ou usar o Peekr, você concorda em ficar vinculado a estes Termos de Serviço e à nossa Política de Privacidade.",
            "Se você não concordar com estes Termos, não deverá usar o Peekr.",
          ],
        },
        {
          title: "2. Quem opera o Peekr",
          body: [
            "Peekr é de propriedade e operado por Emanation Films, Inc. Nestes Termos, “Peekr”, “nós” e “nosso” referem-se à Emanation Films, Inc. e ao serviço Peekr.",
          ],
        },
        {
          title: "3. Elegibilidade e contas",
          body: [
            "Você só pode usar o Peekr se tiver capacidade legal para celebrar um contrato vinculante de acordo com a lei aplicável.",
            "Você é responsável por manter a confidencialidade das credenciais da sua conta e por todas as atividades realizadas por meio dela.",
            "Você concorda em fornecer informações precisas e manter suas informações de conta razoavelmente atualizadas.",
          ],
        },
        {
          title: "4. Uso do serviço",
          body: [
            "Peekr é uma plataforma social para filmes e séries que permite aos usuários registrar atividade de visualização, publicar avaliações e comentários, criar listas, descobrir títulos e pessoas e interagir com outros usuários.",
            "Você só pode usar o Peekr para fins legais e de acordo com estes Termos.",
          ],
        },
        {
          title: "5. Conteúdo do usuário",
          body: [
            "Você pode enviar ou publicar conteúdo por meio do Peekr, incluindo avaliações, comentários, informações de perfil, listas e outro conteúdo gerado pelo usuário.",
            "Você mantém a propriedade do conteúdo que cria, mas ao enviar conteúdo ao Peekr, concede a nós uma licença mundial, não exclusiva, isenta de royalties e sublicenciável para hospedar, armazenar, reproduzir, adaptar, exibir, distribuir e de outra forma usar esse conteúdo conforme necessário para operar, promover, melhorar e fornecer o serviço.",
            "Você declara e garante que possui os direitos necessários para enviar o conteúdo e conceder os direitos descritos acima.",
          ],
        },
        {
          title: "6. Recursos públicos e sociais",
          body: [
            "Peekr inclui recursos sociais e voltados ao público. Dependendo do design do produto e das configurações da sua conta, seu nome de usuário, imagem de perfil, avaliações, comentários, listas, follows e atividade de visualização podem ser visíveis para outros usuários ou para o público.",
            "Você é responsável pelo conteúdo que escolher disponibilizar por meio do serviço.",
          ],
        },
        {
          title: "7. Conduta proibida",
          body: [
            "Você concorda em não usar o Peekr para violar qualquer lei, infringir direitos de terceiros, assediar ou ameaçar outras pessoas, se passar por outra pessoa, enviar conteúdo ilegal ou prejudicial, tentar acesso não autorizado, interferir no serviço, fazer scraping ou copiar o serviço de maneira abusiva, distribuir malware ou participar de comportamento fraudulento, enganoso ou abusivo.",
            "Podemos investigar e tomar medidas contra comportamentos que considerarmos violar estes Termos ou ameaçar a segurança, integridade ou operação do Peekr.",
          ],
        },
        {
          title: "8. Conteúdo e serviços de terceiros",
          body: [
            "O Peekr pode exibir ou depender de conteúdo, metadados, links e serviços fornecidos por terceiros, incluindo fontes de dados sobre filmes, séries, elenco, equipe, premiações, plataformas e entretenimento relacionado.",
            "Não somos responsáveis por sites, serviços ou conteúdo de terceiros, e seu uso desses serviços pode estar sujeito aos próprios termos e políticas deles.",
          ],
        },
        {
          title: "9. Propriedade intelectual",
          body: [
            "Exceto pelo conteúdo do usuário e conteúdo de terceiros disponibilizado sob direitos aplicáveis, o Peekr e seu serviço, software, design, marca, textos, gráficos e materiais relacionados são de propriedade ou licenciados à Emanation Films, Inc. e protegidos por leis de propriedade intelectual.",
            "Você não pode copiar, reproduzir, modificar, distribuir, criar obras derivadas, fazer engenharia reversa ou explorar o serviço, exceto conforme expressamente permitido por lei ou por nós por escrito.",
          ],
        },
        {
          title: "10. Suspensão e encerramento",
          body: [
            "Podemos suspender, restringir ou encerrar seu acesso ao Peekr a qualquer momento, com ou sem aviso, se acreditarmos que você violou estes Termos, criou risco legal, prejudicou outros usuários ou ameaçou a integridade ou operação do serviço.",
            "Você pode parar de usar o serviço a qualquer momento. Certas disposições destes Termos sobreviverão ao encerramento por sua própria natureza.",
          ],
        },
        {
          title: "11. Disponibilidade e alterações",
          body: [
            "Podemos modificar, suspender ou descontinuar qualquer parte do Peekr a qualquer momento. Não garantimos que o serviço estará sempre disponível, ininterrupto, seguro ou livre de erros.",
            "Também podemos atualizar estes Termos periodicamente. Quando isso ocorrer, poderemos revisar a data de vigência e, quando apropriado, fornecer aviso adicional.",
          ],
        },
        {
          title: "12. Isenções de garantia",
          body: [
            "O Peekr é fornecido “como está” e “conforme disponível” na máxima extensão permitida por lei. Renunciamos a garantias de qualquer tipo, expressas, implícitas ou legais, incluindo garantias de comerciabilidade, adequação a um fim específico, não violação e disponibilidade.",
            "Não garantimos a precisão, integridade ou confiabilidade de conteúdo de terceiros, metadados, recomendações ou conteúdo gerado por usuários.",
          ],
        },
        {
          title: "13. Limitação de responsabilidade",
          body: [
            "Na máxima extensão permitida por lei, Emanation Films, Inc. e suas afiliadas, diretores, executivos, funcionários, contratados, licenciadores e prestadores de serviços não serão responsáveis por danos indiretos, incidentais, especiais, consequenciais, exemplares ou punitivos, nem por perda de lucros, dados, goodwill ou oportunidades de negócio decorrentes de ou relacionados ao seu uso do Peekr.",
            "Na máxima extensão permitida por lei, nossa responsabilidade total por qualquer reclamação decorrente de ou relacionada ao Peekr não excederá o maior valor entre o que você nos pagou, se houver, nos doze meses anteriores à reclamação, ou cem dólares americanos (US$100).",
          ],
        },
        {
          title: "14. Indenização",
          body: [
            "Você concorda em indenizar, defender e isentar Emanation Films, Inc. e suas afiliadas, diretores, executivos, funcionários, contratados, licenciadores e prestadores de serviços de reclamações, responsabilidades, danos, perdas e despesas decorrentes de ou relacionadas ao seu conteúdo, ao seu uso do Peekr, à sua violação destes Termos ou à violação de direitos de terceiros.",
          ],
        },
        {
          title: "15. Lei aplicável",
          body: [
            "Estes Termos são regidos e interpretados de acordo com as leis aplicáveis à Emanation Films, Inc., sem considerar princípios de conflito de leis, exceto quando a legislação local obrigatória determinar o contrário.",
            "Qualquer disputa decorrente de ou relacionada a estes Termos ou ao Peekr estará sujeita à jurisdição e foro permitidos pela legislação aplicável.",
          ],
        },
        {
          title: "16. Contato",
          body: [
            "Peekr é de propriedade e operado por Emanation Films, Inc.",
            "Para suporte, solicitações legais ou dúvidas sobre estes Termos, entre em contato pelo e-mail: info@peekr.app.",
            "Site: https://www.peekr.app",
          ],
        },
      ],
    },
  }[lang];

  return (
    <>
      <style>{`
        .legal-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 980px;
          margin: 0 auto;
          color: white;
        }

        .legal-hero {
          padding-top: 6px;
        }

        .legal-eyebrow {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250, 0, 130, 0.12);
          color: #FA0082;
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .legal-hero h1 {
          margin: 0;
          font-size: clamp(34px, 8vw, 60px);
          line-height: 0.98;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .legal-meta {
          margin-top: 14px;
          color: rgba(255,255,255,0.58);
          font-size: 14px;
          font-weight: 700;
        }

        .legal-intro {
          margin-top: 18px;
          color: rgba(255,255,255,0.76);
          font-size: 16px;
          line-height: 1.85;
          max-width: 860px;
        }

        .legal-card {
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          padding: 22px;
        }

        .legal-section + .legal-section {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .legal-section h2 {
          margin: 0 0 12px 0;
          font-size: 24px;
          line-height: 1.08;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .legal-section p {
          margin: 0 0 12px 0;
          color: rgba(255,255,255,0.76);
          font-size: 15px;
          line-height: 1.85;
        }

        .legal-section p:last-child {
          margin-bottom: 0;
        }
      `}</style>

      <div className="legal-page">
        <section className="legal-hero">
          <div className="legal-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <div className="legal-meta">
            {t.updated}: {t.date}
          </div>
          <p className="legal-intro">{t.intro}</p>
        </section>

        <section className="legal-card">
          {t.sections.map((section) => (
            <div key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
