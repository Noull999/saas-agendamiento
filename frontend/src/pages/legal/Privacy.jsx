import LegalLayout, { LegalSection } from './LegalLayout';

/**
 * POLÍTICA DE PRIVACIDAD
 *
 * ⚠️  IMPORTANTE — ANTES DE COBRAR A CLIENTES REALES:
 *   Reemplaza los marcadores [ENTRE CORCHETES] con los datos reales de tu empresa.
 *   Esta plataforma trata DATOS DE SALUD (datos sensibles). En Chile esto se rige por la
 *   Ley 19.628 sobre Protección de la Vida Privada y la Ley 21.719 (nuevo marco de protección
 *   de datos personales). Se recomienda revisión por un abogado antes del lanzamiento comercial.
 */

const COMPANY = {
  razonSocial: '[TU RAZÓN SOCIAL O NOMBRE]',
  rut: '[TU RUT]',
  email: '[TU EMAIL DE CONTACTO]',
  direccion: '[TU DIRECCIÓN]',
};

export default function Privacy() {
  return (
    <LegalLayout title="Política de Privacidad" updatedAt="8 de junio de 2026">
      <p>
        En AgendaSaaS, operada por {COMPANY.razonSocial} (RUT {COMPANY.rut}), valoramos tu privacidad
        y la de las personas cuyos datos se gestionan en la plataforma. Esta Política explica qué datos
        recopilamos, con qué fines, cómo los protegemos y qué derechos tienes. Se rige por la legislación
        chilena aplicable, en particular la Ley N° 19.628 sobre Protección de la Vida Privada y la
        Ley N° 21.719 sobre protección de datos personales.
      </p>

      <LegalSection n="1" title="Roles: responsable y encargado">
        <p>
          Distinguimos dos situaciones:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Datos de la cuenta del negocio</strong> (tu nombre, email, teléfono, datos de
            facturación): aquí actuamos como <strong>responsables</strong> del tratamiento.
          </li>
          <li>
            <strong>Datos de tus clientes o pacientes</strong> que tú ingresas (nombre, contacto,
            fichas, consultas): aquí actuamos como <strong>encargados</strong> y los tratamos por cuenta
            tuya y según tus instrucciones. Tú eres el responsable de dichos datos.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n="2" title="Datos que recopilamos">
        <p><strong>De los negocios usuarios:</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Datos de registro: nombre del negocio, email, teléfono, tipo de negocio.</li>
          <li>Datos de uso: páginas visitadas, acciones en la plataforma, dirección IP, registros técnicos.</li>
          <li>Datos de facturación gestionados por nuestro proveedor de pagos.</li>
        </ul>
        <p className="mt-3"><strong>De los clientes/pacientes finales (ingresados por el negocio):</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Datos de identificación y contacto (nombre, teléfono, email, RUT cuando aplica).</li>
          <li>
            Datos de reservas e historial. En verticales de salud, pueden incluir{' '}
            <strong>datos sensibles de salud</strong> (consultas, notas clínicas, recetas).
          </li>
        </ul>
      </LegalSection>

      <LegalSection n="3" title="Finalidades del tratamiento">
        <ul className="list-disc pl-6 space-y-1">
          <li>Prestar y operar el Servicio de agendamiento.</li>
          <li>Enviar confirmaciones y recordatorios de citas (email / WhatsApp).</li>
          <li>Gestionar la facturación y suscripción.</li>
          <li>Brindar soporte y mejorar la plataforma.</li>
          <li>Cumplir obligaciones legales.</li>
        </ul>
      </LegalSection>

      <LegalSection n="4" title="Datos sensibles de salud">
        <p>
          Cuando un negocio del rubro salud registra información clínica, esta constituye un dato
          sensible. Aplicamos medidas reforzadas: la información clínica (como nombres de pacientes y
          notas) se almacena <strong>cifrada</strong> (AES-256) en reposo. El negocio que los ingresa
          es responsable de contar con el consentimiento del paciente y de tratar estos datos conforme
          a la ley y a la lex artis médica.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Base de legitimación">
        <p>
          Tratamos los datos sobre la base de: la ejecución del contrato (prestación del Servicio),
          el consentimiento (cuando corresponde, especialmente para datos sensibles), el cumplimiento
          de obligaciones legales y nuestro interés legítimo en operar y mejorar la plataforma.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Encargados y terceros proveedores">
        <p>
          Para operar utilizamos proveedores que tratan datos por cuenta nuestra bajo acuerdos de
          confidencialidad y seguridad, entre ellos:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Proveedor de infraestructura/hosting de la base de datos y el backend.</li>
          <li>Proveedor de envío de correos (SMTP).</li>
          <li>Proveedor de mensajería (WhatsApp / Twilio) para recordatorios.</li>
          <li>Proveedor de pagos para la gestión de suscripciones.</li>
        </ul>
        <p>No vendemos tus datos personales a terceros.</p>
      </LegalSection>

      <LegalSection n="7" title="Transferencias internacionales">
        <p>
          Algunos proveedores pueden alojar o procesar datos fuera de Chile. En esos casos adoptamos
          resguardos razonables para que el tratamiento cumpla con un nivel de protección adecuado.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Conservación de los datos">
        <p>
          Conservamos los datos mientras la cuenta esté activa y durante los plazos necesarios para
          cumplir obligaciones legales o contables. Tras el cierre de la cuenta, podrás solicitar la
          exportación de tus datos durante un plazo razonable, luego del cual procederemos a su
          eliminación o anonimización.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Seguridad">
        <p>
          Aplicamos medidas técnicas y organizativas razonables: cifrado de datos sensibles en reposo,
          contraseñas con hashing (bcrypt), conexiones cifradas (HTTPS), control de acceso por cuenta,
          límites de tasa de peticiones y registros de auditoría. Ningún sistema es 100% infalible, pero
          trabajamos para minimizar los riesgos.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Tus derechos">
        <p>
          De acuerdo con la ley, puedes ejercer los derechos de acceso, rectificación, cancelación
          (supresión) y oposición sobre tus datos personales, así como la portabilidad cuando proceda.
        </p>
        <p>
          Si eres un cliente/paciente final y deseas ejercer tus derechos, contacta directamente al
          negocio que registró tus datos (el responsable). Si eres un negocio usuario, puedes ejercerlos
          escribiéndonos a{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-red-400 hover:text-red-300 hover:underline">{COMPANY.email}</a>.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Cookies y almacenamiento local">
        <p>
          Utilizamos almacenamiento local del navegador para mantener tu sesión iniciada (token de
          autenticación). No usamos cookies de publicidad de terceros.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Cambios a esta Política">
        <p>
          Podemos actualizar esta Política. Publicaremos la versión vigente con su fecha de última
          actualización y, ante cambios sustanciales, te lo notificaremos por los medios disponibles.
        </p>
      </LegalSection>

      <LegalSection n="13" title="Contacto">
        <p>
          Responsable: {COMPANY.razonSocial}, {COMPANY.direccion}.<br />
          Correo de contacto:{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-red-400 hover:text-red-300 hover:underline">{COMPANY.email}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
