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
    title: "Privacy Policy | Peekr",
    description:
      "Privacy Policy for Peekr, owned and operated by Emanation Films, Inc.",
    alternates: {
      canonical: "https://www.peekr.app/privacy",
    },
    openGraph: {
      title: "Privacy Policy | Peekr",
      description:
        "Privacy Policy for Peekr, owned and operated by Emanation Films, Inc.",
      url: "https://www.peekr.app/privacy",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Privacy Policy | Peekr",
      description:
        "Privacy Policy for Peekr, owned and operated by Emanation Films, Inc.",
    },
  };
}

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Privacy Policy",
      title: "Privacy Policy",
      updated: "Last updated",
      date: "March 18, 2026",
      intro:
        "This Privacy Policy explains how Peekr collects, uses, stores, and shares information when you use the Peekr website, mobile app, and related services. Peekr is owned and operated by Emanation Films, Inc.",
      sections: [
        {
          title: "1. Who we are",
          body: [
            "Peekr is a social platform for movies and series owned and operated by Emanation Films, Inc. Throughout this Privacy Policy, “Peekr,” “we,” “us,” and “our” refer to Emanation Films, Inc. and the Peekr service.",
            "If you have questions about this Privacy Policy or about your personal information, you can contact us at info@peekr.app.",
          ],
        },
        {
          title: "2. Information we collect",
          body: [
            "We may collect information you provide directly, including your name, email address, username, profile details, profile image, support messages, comments, ratings, lists, and any other content you submit through the service.",
            "We may also collect activity data related to your use of Peekr, such as titles you view, titles you rate, items you add to lists or watchlists, social interactions, preferences, language settings, and account actions.",
            "When you use our website or app, we may collect technical information such as device type, browser type, IP address, app version, operating system, log data, and analytics events needed to operate, secure, and improve the service.",
          ],
        },
        {
          title: "3. Information from third parties",
          body: [
            "We may receive information from third-party services and infrastructure providers used to operate Peekr, including authentication, hosting, analytics, push notification, email, and content metadata providers.",
            "Peekr may display movie, television, cast, crew, and related metadata from third-party entertainment databases and content sources. This data is used to provide the product experience and is not necessarily submitted by users.",
          ],
        },
        {
          title: "4. How we use information",
          body: [
            "We use information to provide and maintain Peekr, create and manage accounts, authenticate users, display ratings and social activity, operate lists and comments, deliver support, and communicate with users.",
            "We also use information to personalize content, improve product features, monitor performance, analyze usage trends, prevent abuse, enforce our policies, protect the security of the service, and comply with legal obligations.",
            "If you contact us, we use the information you provide to respond to your request, investigate issues, and maintain support records.",
          ],
        },
        {
          title: "5. Public content and social features",
          body: [
            "Peekr includes social and community features. Depending on the product design and your account settings, information such as your username, profile image, ratings, comments, lists, follows, and watch activity may be visible to other users or to the public.",
            "You should only submit content that you are comfortable sharing through a social service. Public or social content may remain visible to others even after it has been copied, shared, or referenced by other users.",
          ],
        },
        {
          title: "6. How we share information",
          body: [
            "We may share information with service providers and vendors that help us operate Peekr, such as hosting providers, infrastructure providers, analytics providers, push notification services, email services, and customer support tools.",
            "We may also disclose information if required by law, to respond to valid legal requests, to protect rights or safety, to investigate fraud or abuse, or in connection with a merger, acquisition, financing, or sale of all or part of our business.",
            "We do not sell personal information in the ordinary meaning of selling user data to data brokers for independent commercial use.",
          ],
        },
        {
          title: "7. Cookies, analytics, and similar technologies",
          body: [
            "Peekr may use cookies, local storage, pixels, SDKs, and similar technologies to keep you signed in, remember preferences, measure performance, understand usage, and improve the service.",
            "Your browser or device may give you some ability to control cookies or similar technologies, but disabling them may affect how Peekr works.",
          ],
        },
        {
          title: "8. Data retention",
          body: [
            "We retain information for as long as reasonably necessary to operate Peekr, provide the services, maintain records, resolve disputes, enforce agreements, and comply with legal obligations.",
            "Retention periods may vary depending on the type of information, the nature of the service, and legal or operational needs. Some information may remain in backups or archived systems for a limited period after deletion.",
          ],
        },
        {
          title: "9. Your choices and rights",
          body: [
            "Depending on your location, you may have rights to request access to, correction of, deletion of, or restriction of your personal information, or to object to certain uses of your information.",
            "You may also have rights related to data portability or withdrawal of consent where consent is the basis for processing.",
            "To make a privacy request, contact info@peekr.app. We may need to verify your identity before processing certain requests.",
          ],
        },
        {
          title: "10. Children’s privacy",
          body: [
            "Peekr is not intended for children below the minimum age permitted under applicable law. If we become aware that we have collected personal information from a child in violation of applicable law, we may delete that information and take appropriate steps regarding the account.",
          ],
        },
        {
          title: "11. International data transfers",
          body: [
            "Peekr may use infrastructure and service providers located in different countries. By using the service, you understand that your information may be processed and stored in jurisdictions outside your own, subject to applicable safeguards and legal requirements.",
          ],
        },
        {
          title: "12. Security",
          body: [
            "We take reasonable technical and organizational measures designed to protect information, but no system can be guaranteed to be completely secure. You are responsible for maintaining the confidentiality of your account credentials and for notifying us if you believe your account has been compromised.",
          ],
        },
        {
          title: "13. Changes to this Privacy Policy",
          body: [
            "We may update this Privacy Policy from time to time. When we do, we may revise the “Last updated” date and, where appropriate, provide additional notice.",
            "Your continued use of Peekr after an updated Privacy Policy becomes effective means the updated version will apply to your use of the service, subject to applicable law.",
          ],
        },
        {
          title: "14. Contact",
          body: [
            "Peekr is owned and operated by Emanation Films, Inc.",
            "Privacy, support, and legal contact: info@peekr.app",
            "Website: https://www.peekr.app",
          ],
        },
      ],
    },
    es: {
      eyebrow: "Política de Privacidad",
      title: "Política de Privacidad",
      updated: "Última actualización",
      date: "18 de marzo de 2026",
      intro:
        "Esta Política de Privacidad explica cómo Peekr recopila, usa, almacena y comparte información cuando usted utiliza el sitio web de Peekr, su app móvil y sus servicios relacionados. Peekr es propiedad y es operada por Emanation Films, Inc.",
      sections: [
        {
          title: "1. Quiénes somos",
          body: [
            "Peekr es una plataforma social para películas y series propiedad y operada por Emanation Films, Inc. En esta Política de Privacidad, “Peekr”, “nosotros” y “nuestro” se refieren a Emanation Films, Inc. y al servicio Peekr.",
            "Si tiene preguntas sobre esta Política de Privacidad o sobre su información personal, puede contactarnos en info@peekr.app.",
          ],
        },
        {
          title: "2. Información que recopilamos",
          body: [
            "Podemos recopilar información que usted nos proporciona directamente, incluyendo nombre, correo electrónico, nombre de usuario, datos de perfil, imagen de perfil, mensajes de soporte, comentarios, ratings, listas y cualquier otro contenido que envíe a través del servicio.",
            "También podemos recopilar datos de actividad relacionados con su uso de Peekr, como títulos vistos, títulos calificados, elementos agregados a listas o watchlists, interacciones sociales, preferencias, idioma y acciones de cuenta.",
            "Cuando usa nuestro sitio web o app, podemos recopilar información técnica como tipo de dispositivo, navegador, dirección IP, versión de la app, sistema operativo, logs y eventos analíticos necesarios para operar, asegurar y mejorar el servicio.",
          ],
        },
        {
          title: "3. Información de terceros",
          body: [
            "Podemos recibir información de servicios de terceros y proveedores de infraestructura utilizados para operar Peekr, incluyendo autenticación, hosting, analítica, notificaciones push, email y proveedores de metadata.",
            "Peekr puede mostrar metadata de películas, series, cast, crew y contenido relacionado proveniente de bases de datos y fuentes de entretenimiento de terceros. Estos datos se utilizan para ofrecer la experiencia del producto y no necesariamente son enviados por usuarios.",
          ],
        },
        {
          title: "4. Cómo usamos la información",
          body: [
            "Usamos la información para ofrecer y mantener Peekr, crear y administrar cuentas, autenticar usuarios, mostrar ratings y actividad social, operar listas y comentarios, brindar soporte y comunicarnos con los usuarios.",
            "También usamos la información para personalizar contenido, mejorar funciones del producto, monitorear rendimiento, analizar tendencias de uso, prevenir abuso, hacer cumplir políticas, proteger la seguridad del servicio y cumplir obligaciones legales.",
            "Si nos contacta, usamos la información proporcionada para responder su solicitud, investigar problemas y mantener registros de soporte.",
          ],
        },
        {
          title: "5. Contenido público y funciones sociales",
          body: [
            "Peekr incluye funciones sociales y de comunidad. Dependiendo del diseño del producto y de la configuración de su cuenta, información como nombre de usuario, imagen de perfil, ratings, comentarios, listas, follows y actividad de visualización puede ser visible para otros usuarios o para el público.",
            "Solo debe enviar contenido que se sienta cómodo compartiendo a través de un servicio social. El contenido público o social puede seguir siendo visible para otros incluso después de haber sido copiado, compartido o referenciado por terceros.",
          ],
        },
        {
          title: "6. Cómo compartimos la información",
          body: [
            "Podemos compartir información con proveedores y vendedores que nos ayudan a operar Peekr, como hosting, infraestructura, analítica, notificaciones push, email y herramientas de soporte.",
            "También podemos divulgar información si es requerido por ley, para responder a solicitudes legales válidas, para proteger derechos o seguridad, investigar fraude o abuso, o en relación con una fusión, adquisición, financiamiento o venta de todo o parte de nuestro negocio.",
            "No vendemos información personal en el sentido habitual de vender datos de usuarios a brokers de datos para uso comercial independiente.",
          ],
        },
        {
          title: "7. Cookies, analítica y tecnologías similares",
          body: [
            "Peekr puede usar cookies, almacenamiento local, píxeles, SDKs y tecnologías similares para mantener la sesión, recordar preferencias, medir rendimiento, entender uso y mejorar el servicio.",
            "Su navegador o dispositivo puede darle cierto control sobre cookies o tecnologías similares, pero desactivarlas puede afectar el funcionamiento de Peekr.",
          ],
        },
        {
          title: "8. Retención de datos",
          body: [
            "Conservamos la información durante el tiempo razonablemente necesario para operar Peekr, prestar servicios, mantener registros, resolver disputas, hacer cumplir acuerdos y cumplir obligaciones legales.",
            "Los períodos de retención pueden variar según el tipo de información, la naturaleza del servicio y necesidades legales u operativas. Parte de la información puede permanecer en backups o sistemas archivados por un período limitado después de su eliminación.",
          ],
        },
        {
          title: "9. Sus opciones y derechos",
          body: [
            "Dependiendo de su ubicación, usted puede tener derecho a solicitar acceso, corrección, eliminación o restricción de su información personal, o a oponerse a ciertos usos de dicha información.",
            "También puede tener derechos relacionados con portabilidad de datos o retiro del consentimiento cuando el consentimiento sea la base del tratamiento.",
            "Para hacer una solicitud de privacidad, escriba a info@peekr.app. Es posible que necesitemos verificar su identidad antes de procesar ciertas solicitudes.",
          ],
        },
        {
          title: "10. Privacidad de menores",
          body: [
            "Peekr no está dirigido a menores por debajo de la edad mínima permitida por la ley aplicable. Si tomamos conocimiento de que hemos recopilado información personal de un menor en violación de la ley aplicable, podemos eliminar dicha información y tomar las medidas apropiadas respecto de la cuenta.",
          ],
        },
        {
          title: "11. Transferencias internacionales de datos",
          body: [
            "Peekr puede utilizar infraestructura y proveedores de servicios ubicados en distintos países. Al usar el servicio, usted entiende que su información puede ser procesada y almacenada en jurisdicciones fuera de la suya, sujeto a las salvaguardas y requisitos legales aplicables.",
          ],
        },
        {
          title: "12. Seguridad",
          body: [
            "Tomamos medidas técnicas y organizativas razonables diseñadas para proteger la información, pero ningún sistema puede garantizar seguridad absoluta. Usted es responsable de mantener la confidencialidad de sus credenciales de cuenta y de notificarnos si cree que su cuenta ha sido comprometida.",
          ],
        },
        {
          title: "13. Cambios a esta Política de Privacidad",
          body: [
            "Podemos actualizar esta Política de Privacidad periódicamente. Cuando lo hagamos, podremos revisar la fecha de “Última actualización” y, cuando corresponda, dar un aviso adicional.",
            "Su uso continuado de Peekr después de que una Política de Privacidad actualizada entre en vigor significa que la versión actualizada aplicará a su uso del servicio, sujeto a la ley aplicable.",
          ],
        },
        {
          title: "14. Contacto",
          body: [
            "Peekr es propiedad y es operada por Emanation Films, Inc.",
            "Contacto de privacidad, soporte y asuntos legales: info@peekr.app",
            "Sitio web: https://www.peekr.app",
          ],
        },
      ],
    },
    pt: {
      eyebrow: "Política de Privacidade",
      title: "Política de Privacidade",
      updated: "Última atualização",
      date: "18 de março de 2026",
      intro:
        "Esta Política de Privacidade explica como o Peekr coleta, usa, armazena e compartilha informações quando você utiliza o site do Peekr, o aplicativo móvel e serviços relacionados. O Peekr é de propriedade e operado por Emanation Films, Inc.",
      sections: [
        {
          title: "1. Quem somos",
          body: [
            "Peekr é uma plataforma social para filmes e séries de propriedade e operada por Emanation Films, Inc. Nesta Política de Privacidade, “Peekr”, “nós” e “nosso” se referem à Emanation Films, Inc. e ao serviço Peekr.",
            "Se você tiver dúvidas sobre esta Política de Privacidade ou sobre suas informações pessoais, entre em contato pelo e-mail info@peekr.app.",
          ],
        },
        {
          title: "2. Informações que coletamos",
          body: [
            "Podemos coletar informações que você fornece diretamente, incluindo nome, endereço de e-mail, nome de usuário, dados de perfil, imagem de perfil, mensagens de suporte, comentários, avaliações, listas e qualquer outro conteúdo enviado por meio do serviço.",
            "Também podemos coletar dados de atividade relacionados ao uso do Peekr, como títulos visualizados, títulos avaliados, itens adicionados a listas ou watchlists, interações sociais, preferências, idioma e ações da conta.",
            "Quando você usa nosso site ou aplicativo, podemos coletar informações técnicas como tipo de dispositivo, tipo de navegador, endereço IP, versão do aplicativo, sistema operacional, logs e eventos analíticos necessários para operar, proteger e melhorar o serviço.",
          ],
        },
        {
          title: "3. Informações de terceiros",
          body: [
            "Podemos receber informações de serviços de terceiros e provedores de infraestrutura usados para operar o Peekr, incluindo autenticação, hospedagem, analytics, notificações push, e-mail e provedores de metadados.",
            "O Peekr pode exibir metadados de filmes, séries, elenco, equipe e conteúdo relacionado provenientes de bancos de dados de entretenimento e fontes terceiras. Esses dados são usados para oferecer a experiência do produto e não são necessariamente enviados por usuários.",
          ],
        },
        {
          title: "4. Como usamos as informações",
          body: [
            "Usamos informações para fornecer e manter o Peekr, criar e gerenciar contas, autenticar usuários, exibir avaliações e atividade social, operar listas e comentários, prestar suporte e nos comunicar com usuários.",
            "Também usamos informações para personalizar conteúdo, melhorar recursos do produto, monitorar desempenho, analisar tendências de uso, prevenir abusos, aplicar nossas políticas, proteger a segurança do serviço e cumprir obrigações legais.",
            "Se você entrar em contato conosco, usamos as informações fornecidas para responder à sua solicitação, investigar problemas e manter registros de suporte.",
          ],
        },
        {
          title: "5. Conteúdo público e recursos sociais",
          body: [
            "O Peekr inclui recursos sociais e de comunidade. Dependendo do design do produto e das configurações da sua conta, informações como seu nome de usuário, imagem de perfil, avaliações, comentários, listas, follows e atividade de visualização podem ser visíveis para outros usuários ou para o público.",
            "Você só deve enviar conteúdo que se sinta confortável em compartilhar em um serviço social. Conteúdo público ou social pode permanecer visível para outros mesmo após ter sido copiado, compartilhado ou referenciado por terceiros.",
          ],
        },
        {
          title: "6. Como compartilhamos informações",
          body: [
            "Podemos compartilhar informações com provedores e fornecedores que ajudam a operar o Peekr, como hospedagem, infraestrutura, analytics, notificações push, e-mail e ferramentas de suporte.",
            "Também podemos divulgar informações se exigido por lei, para responder a solicitações legais válidas, proteger direitos ou segurança, investigar fraude ou abuso, ou em conexão com fusão, aquisição, financiamento ou venda de todo ou parte do nosso negócio.",
            "Não vendemos informações pessoais no sentido comum de vender dados de usuários a corretores de dados para uso comercial independente.",
          ],
        },
        {
          title: "7. Cookies, analytics e tecnologias semelhantes",
          body: [
            "O Peekr pode usar cookies, armazenamento local, pixels, SDKs e tecnologias semelhantes para manter você conectado, lembrar preferências, medir desempenho, entender uso e melhorar o serviço.",
            "Seu navegador ou dispositivo pode oferecer algum controle sobre cookies ou tecnologias semelhantes, mas desativá-los pode afetar o funcionamento do Peekr.",
          ],
        },
        {
          title: "8. Retenção de dados",
          body: [
            "Retemos informações pelo tempo razoavelmente necessário para operar o Peekr, prestar os serviços, manter registros, resolver disputas, aplicar contratos e cumprir obrigações legais.",
            "Os períodos de retenção podem variar de acordo com o tipo de informação, a natureza do serviço e necessidades legais ou operacionais. Algumas informações podem permanecer em backups ou sistemas arquivados por um período limitado após a exclusão.",
          ],
        },
        {
          title: "9. Suas escolhas e direitos",
          body: [
            "Dependendo da sua localização, você pode ter o direito de solicitar acesso, correção, exclusão ou restrição de suas informações pessoais, ou de se opor a certos usos dessas informações.",
            "Você também pode ter direitos relacionados à portabilidade de dados ou retirada de consentimento quando o consentimento for a base do tratamento.",
            "Para fazer uma solicitação de privacidade, entre em contato pelo e-mail info@peekr.app. Podemos precisar verificar sua identidade antes de processar determinadas solicitações.",
          ],
        },
        {
          title: "10. Privacidade infantil",
          body: [
            "O Peekr não é destinado a crianças abaixo da idade mínima permitida pela legislação aplicável. Se tomarmos conhecimento de que coletamos informações pessoais de uma criança em violação à lei aplicável, poderemos excluir essas informações e tomar medidas apropriadas em relação à conta.",
          ],
        },
        {
          title: "11. Transferências internacionais de dados",
          body: [
            "O Peekr pode usar infraestrutura e provedores de serviços localizados em diferentes países. Ao usar o serviço, você entende que suas informações podem ser processadas e armazenadas em jurisdições fora da sua, sujeitas às salvaguardas e exigências legais aplicáveis.",
          ],
        },
        {
          title: "12. Segurança",
          body: [
            "Tomamos medidas técnicas e organizacionais razoáveis destinadas a proteger informações, mas nenhum sistema pode ser totalmente seguro. Você é responsável por manter a confidencialidade das credenciais da sua conta e por nos informar caso acredite que sua conta foi comprometida.",
          ],
        },
        {
          title: "13. Alterações nesta Política de Privacidade",
          body: [
            "Podemos atualizar esta Política de Privacidade periodicamente. Quando isso acontecer, poderemos revisar a data de “Última atualização” e, quando apropriado, fornecer aviso adicional.",
            "Seu uso continuado do Peekr após a entrada em vigor de uma Política de Privacidade atualizada significa que a versão atualizada se aplicará ao seu uso do serviço, sujeita à legislação aplicável.",
          ],
        },
        {
          title: "14. Contato",
          body: [
            "O Peekr é de propriedade e operado por Emanation Films, Inc.",
            "Contato para privacidade, suporte e assuntos legais: info@peekr.app",
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
