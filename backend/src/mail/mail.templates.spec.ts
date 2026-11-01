import { passwordChangedEmail, passwordResetEmail, verificationEmail } from './mail.templates';

describe('correos', () => {
  const url = 'https://tienda.com.ar/cuenta/restablecer?token=abc_DEF-123';

  it('el enlace va en el texto y en el HTML', () => {
    const mail = passwordResetEmail('Papelería', 'ana@ejemplo.com', 'Ana', url);
    expect(mail.to).toBe('ana@ejemplo.com');
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
  });

  it('escapa el nombre: un nombre malicioso no inyecta HTML', () => {
    const mail = verificationEmail('Papelería', 'x@ejemplo.com', '<script>alert(1)</script>', url);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('el aviso de cambio no lleva enlaces', () => {
    const mail = passwordChangedEmail('Papelería', 'ana@ejemplo.com', 'Ana');
    expect(mail.html).not.toContain('href=');
    expect(mail.subject).toContain('Papelería');
  });

  it('cada correo dice cuánto dura su enlace', () => {
    expect(verificationEmail('S', 'a@b.com', 'A', url).text).toContain('24 horas');
    expect(passwordResetEmail('S', 'a@b.com', 'A', url).text).toContain('1 hora');
  });
});
