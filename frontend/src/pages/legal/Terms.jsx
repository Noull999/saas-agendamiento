import LegalLayout, { LegalSection } from './LegalLayout';

/**
 * TÉRMINOS DE SERVICIO
 *
 * ⚠️  IMPORTANTE — ANTES DE COBRAR A CLIENTES REALES:
 *   Reemplaza los marcadores [ENTRE CORCHETES] con los datos reales de tu empresa.
 *   Este documento es una base sólida pero NO sustituye la revisión de un abogado,
 *   especialmente porque la plataforma maneja datos de salud (datos sensibles).
 */

const COMPANY = {
  razonSocial: '[TU RAZÓN SOCIAL O NOMBRE]',
  rut: '[TU RUT]',
  email: '[TU EMAIL DE CONTACTO]',
  pais: 'Chile',
};

export default function Terms() {
  return (
    <LegalLayout title="Términos de Servicio" updatedAt="8 de junio de 2026">
      <p>
        Estos Términos de Servicio (los «Términos») regulan el uso de la plataforma AgendaSaaS
        (el «Servicio»), operada por {COMPANY.razonSocial}, RUT {COMPANY.rut} («nosotros»).
        Al crear una cuenta o utilizar el Servicio aceptas estos Términos en su totalidad. Si no
        estás de acuerdo, no utilices el Servicio.
      </p>

      <LegalSection n="1" title="Descripción del Servicio">
        <p>
          AgendaSaaS es una plataforma de software como servicio (SaaS) que permite a negocios
          y profesionales gestionar reservas de citas, agendas, clientes/pacientes y recordatorios,
          además de publicar una página de reservas pública. El Servicio se ofrece bajo distintos
          planes (Basic, Pro y Business) con diferentes funcionalidades y límites.
        </p>
      </LegalSection>

      <LegalSection n="2" title="Cuentas y registro">
        <p>
          Para usar el Servicio debes crear una cuenta con información veraz y mantenerla
          actualizada. Eres responsable de la confidencialidad de tu contraseña y de toda actividad
          realizada bajo tu cuenta. Debes notificarnos de inmediato ante cualquier uso no autorizado.
        </p>
        <p>Debes ser mayor de edad y tener capacidad legal para contratar.</p>
      </LegalSection>

      <LegalSection n="3" title="Planes, pagos y facturación">
        <p>
          Los planes de pago se facturan de forma recurrente (mensual) según el plan contratado.
          Los precios se indican en pesos chilenos (CLP) e incluyen o excluyen impuestos según se
          señale al momento de la contratación.
        </p>
        <p>
          La suscripción se renueva automáticamente al final de cada período hasta que la canceles.
          Puedes cancelar en cualquier momento desde tu cuenta; la cancelación surte efecto al final
          del período ya pagado y no genera reembolsos proporcionales, salvo que la ley exija lo contrario.
        </p>
        <p>
          Podemos modificar los precios notificándote con al menos 30 días de anticipación. El cambio
          aplicará en el siguiente ciclo de facturación.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Uso aceptable">
        <p>Te comprometes a no utilizar el Servicio para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Actividades ilícitas o que infrinjan derechos de terceros.</li>
          <li>Cargar contenido malicioso, spam o que vulnere la privacidad de otras personas.</li>
          <li>Intentar acceder sin autorización a la infraestructura, datos de otros negocios o realizar ingeniería inversa.</li>
          <li>Sobrecargar o interferir con el funcionamiento del Servicio.</li>
        </ul>
      </LegalSection>

      <LegalSection n="5" title="Datos de tus clientes y pacientes">
        <p>
          Como usuario del Servicio, eres el responsable del tratamiento de los datos de tus clientes
          o pacientes que ingreses en la plataforma, y nosotros actuamos como encargados del tratamiento
          por cuenta tuya. Te obligas a contar con la base legal y los consentimientos necesarios para
          tratar dichos datos, en especial cuando se trate de datos sensibles de salud.
        </p>
        <p>
          El tratamiento de datos personales se rige además por nuestra{' '}
          <a href="/privacidad" className="text-red-400 hover:text-red-300 hover:underline">Política de Privacidad</a>.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Propiedad intelectual">
        <p>
          El Servicio, su software, marca y contenidos son de nuestra propiedad o de nuestros
          licenciantes. Te otorgamos una licencia limitada, no exclusiva e intransferible para usar
          el Servicio conforme a estos Términos. Los datos que tú ingresas siguen siendo tuyos.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Disponibilidad y soporte">
        <p>
          Hacemos esfuerzos razonables para mantener el Servicio disponible, pero no garantizamos
          un funcionamiento ininterrumpido. Podemos realizar mantenimientos programados y actualizaciones.
          El nivel de soporte depende del plan contratado.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Limitación de responsabilidad">
        <p>
          El Servicio se entrega «tal cual». En la máxima medida permitida por la ley, no seremos
          responsables por daños indirectos, lucro cesante o pérdida de datos. Nuestra responsabilidad
          total se limita al monto pagado por ti en los últimos 3 meses. Nada en estos Términos limita
          responsabilidades que no puedan excluirse según la ley chilena, incluida la Ley 19.496 sobre
          protección de los derechos de los consumidores cuando resulte aplicable.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Suspensión y terminación">
        <p>
          Podemos suspender o terminar tu cuenta si incumples estos Términos o si existe falta de pago.
          Tú puedes cerrar tu cuenta en cualquier momento. Tras la terminación, podrás solicitar la
          exportación de tus datos durante un plazo razonable, después del cual podremos eliminarlos.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Modificaciones de los Términos">
        <p>
          Podemos actualizar estos Términos. Si los cambios son sustanciales, te lo notificaremos por
          email o dentro de la plataforma con antelación razonable. El uso continuado del Servicio tras
          la entrada en vigencia implica tu aceptación.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de {COMPANY.pais}. Cualquier controversia se someterá a
          los tribunales competentes de {COMPANY.pais}.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Contacto">
        <p>
          Para consultas sobre estos Términos, escríbenos a{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-red-400 hover:text-red-300 hover:underline">{COMPANY.email}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
