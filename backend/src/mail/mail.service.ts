import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Tope de mensajes que guarda el modo `memory` (pruebas). */
const OUTBOX_LIMIT = 500;

/**
 * Envío de correo. El proveedor se elige por configuración (`MAIL_DRIVER`):
 *  - `smtp`: envío real, con cualquier proveedor (Brevo, Mailgun, SES, Gmail con contraseña de aplicación…).
 *  - `log`: no envía; escribe el mensaje completo en el log (desarrollo: ahí está el enlace para probar).
 *  - `memory`: lo guarda en `outbox` (pruebas automáticas).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: Transporter;
  /** Solo con `MAIL_DRIVER=memory`. */
  readonly outbox: MailMessage[] = [];

  constructor(@InjectConfig() private readonly config: Env) {
    if (config.MAIL_DRIVER === 'smtp') {
      this.transport = createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        requireTLS: !config.SMTP_SECURE, // nunca mandar credenciales ni mensajes sin cifrar
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
  }

  async send(message: MailMessage): Promise<void> {
    switch (this.config.MAIL_DRIVER) {
      case 'smtp':
        await this.transport!.sendMail({ from: this.config.MAIL_FROM, ...message });
        return;
      case 'memory':
        this.outbox.push(message);
        if (this.outbox.length > OUTBOX_LIMIT) this.outbox.shift();
        return;
      case 'log':
        this.logger.log(`Correo (no enviado, modo log) a ${message.to}: ${message.subject}\n${message.text}`);
        return;
    }
  }

  /**
   * Envía sin esperar y sin propagar errores. Para los avisos que no deben tumbar la operación que los origina
   * (un registro no falla porque el servidor de correo esté caído; el cliente puede pedir el reenvío).
   */
  sendInBackground(message: MailMessage): void {
    this.send(message).catch((error: unknown) => {
      this.logger.error(`No se pudo enviar "${message.subject}": ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}
