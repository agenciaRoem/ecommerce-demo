import type { MailMessage } from './mail.service';

const BRAND_COLOR = '#1d4ed8';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface Layout {
  store: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}

/** Cuerpo en texto y en HTML a partir de los mismos datos, para que los dos digan siempre lo mismo. */
function render({ store, heading, paragraphs, action, footer }: Layout): Pick<MailMessage, 'text' | 'html'> {
  const text = [heading, '', ...paragraphs, ...(action ? ['', `${action.label}: ${action.url}`] : []), '', footer, `— ${store}`].join('\n');
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:18px;font-weight:800;color:${BRAND_COLOR}">${escapeHtml(store)}</td></tr>
      <tr><td style="padding-top:18px;font-size:20px;font-weight:700">${escapeHtml(heading)}</td></tr>
      ${paragraphs.map((p) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5">${escapeHtml(p)}</td></tr>`).join('\n      ')}
      ${
        action
          ? `<tr><td style="padding-top:22px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">${escapeHtml(action.label)}</a></td></tr>
      <tr><td style="padding-top:14px;font-size:12px;color:#64748b;word-break:break-all">Si el botón no funciona, copiá este enlace en el navegador:<br>${escapeHtml(action.url)}</td></tr>`
          : ''
      }
      <tr><td style="padding-top:24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;margin-top:20px">${escapeHtml(footer)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { text, html };
}

export const verificationEmail = (store: string, to: string, name: string, url: string): MailMessage => ({
  to,
  subject: `Confirmá tu email en ${store}`,
  ...render({
    store,
    heading: `Hola, ${name}`,
    paragraphs: ['Confirmá que este email es tuyo para poder comprar y recuperar tu cuenta si algún día olvidás la contraseña.', 'El enlace vale 24 horas.'],
    action: { label: 'Confirmar mi email', url },
    footer: 'Si no creaste una cuenta, ignorá este correo: no se hará ningún cambio.',
  }),
});

export const passwordResetEmail = (store: string, to: string, name: string, url: string): MailMessage => ({
  to,
  subject: `Restablecé tu contraseña de ${store}`,
  ...render({
    store,
    heading: `Hola, ${name}`,
    paragraphs: ['Recibimos un pedido para restablecer la contraseña de tu cuenta.', 'El enlace vale 1 hora y se puede usar una sola vez.'],
    action: { label: 'Elegir una contraseña nueva', url },
    footer: 'Si no lo pediste vos, ignorá este correo: tu contraseña actual sigue funcionando.',
  }),
});

export const passwordChangedEmail = (store: string, to: string, name: string): MailMessage => ({
  to,
  subject: `Cambió la contraseña de tu cuenta de ${store}`,
  ...render({
    store,
    heading: `Hola, ${name}`,
    paragraphs: ['La contraseña de tu cuenta se cambió hace un momento y se cerraron todas tus sesiones abiertas.', 'Si fuiste vos, no tenés que hacer nada.'],
    footer: 'Si no fuiste vos, pedí un restablecimiento de contraseña de inmediato y avisanos.',
  }),
});
