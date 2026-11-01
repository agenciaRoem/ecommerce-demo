import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentGateway as GatewayRecord, PaymentMode, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isUniqueViolation } from '../common/prisma-errors';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { SecretBox } from '../crypto/secret-box.service';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayAccount, GatewayCredentials, GatewayError } from './gateways/payment-gateway';
import { MercadoPagoGateway } from './gateways/mercadopago.gateway';
import type { UpdateGatewayDto } from './payments.schemas';

const PROVIDER = 'MERCADOPAGO' as const;
const WEBHOOK_PATH = '/payments/webhooks/mercadopago';

export interface Actor {
  id: string;
  ip?: string;
}

/** Lo que ve el backoffice. Los secretos nunca viajan: solo una pista con los últimos caracteres. */
export interface GatewayView {
  provider: typeof PROVIDER;
  isEnabled: boolean;
  mode: PaymentMode;
  publicKey: string | null;
  hasAccessToken: boolean;
  accessTokenHint: string | null;
  hasWebhookSecret: boolean;
  webhookSecretHint: string | null;
  account: GatewayAccount | null;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  /** Cobros habilitados: activa, con credenciales validadas. */
  ready: boolean;
  webhookUrl: string;
  updatedAt: Date | null;
}

export interface ActiveGateway {
  accessToken: string;
  mode: PaymentMode;
  webhookSecret: string;
}

const hint = (secret: string) => `••••${secret.slice(-4)}`;

const MESSAGES: Record<GatewayError['kind'], string> = {
  invalid_credentials:
    'Mercado Pago rechazó el Access Token. Revisá que sea el de tu aplicación y que corresponda al modo elegido (prueba o producción).',
  unavailable: 'No pudimos comunicarnos con Mercado Pago. Probá de nuevo en unos minutos.',
  rejected: 'Mercado Pago rechazó la solicitud.',
};

@Injectable()
export class PaymentSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly box: SecretBox,
    private readonly mercadoPago: MercadoPagoGateway,
    private readonly audit: AuditService,
    @InjectConfig() private readonly config: Env,
  ) {}

  async getView(): Promise<GatewayView> {
    return this.toView(await this.find());
  }

  async update(dto: UpdateGatewayDto, actor: Actor): Promise<GatewayView> {
    const current = await this.find();
    const data: Prisma.PaymentGatewayUncheckedCreateInput = { provider: PROVIDER, updatedById: actor.id };
    const changed: string[] = [];

    const mode = dto.mode ?? current?.mode ?? 'SANDBOX';
    if (dto.mode && dto.mode !== current?.mode) {
      data.mode = dto.mode;
      changed.push('mode');
    }

    if (dto.accessToken !== undefined) {
      // Se prueba contra Mercado Pago ANTES de guardar: nunca queda un token inválido almacenado.
      const account = await this.verifyOrThrow(dto.accessToken, mode);
      Object.assign(data, this.accountFields(account), { accessTokenEnc: this.box.encrypt(dto.accessToken), lastError: null });
      changed.push('accessToken');
    }
    if (dto.webhookSecret !== undefined) {
      data.webhookSecretEnc = this.box.encrypt(dto.webhookSecret);
      changed.push('webhookSecret');
    }
    if (dto.publicKey !== undefined && (dto.publicKey || null) !== (current?.publicKey ?? null)) {
      data.publicKey = dto.publicKey || null;
      changed.push('publicKey');
    }

    // Cambiar de cuenta obliga a reactivar a propósito: evita cobrar en la cuenta equivocada sin darse cuenta.
    if (dto.accessToken !== undefined && dto.isEnabled !== true) data.isEnabled = false;
    if (dto.isEnabled !== undefined) {
      if (dto.isEnabled) this.assertCanEnable({ ...current, ...data } as GatewayRecord);
      data.isEnabled = dto.isEnabled;
      changed.push('isEnabled');
    }

    const saved = await this.persist(current, data);

    await this.audit.record({
      actorId: actor.id,
      action: 'payment_gateway.updated',
      entity: 'payment_gateway',
      entityId: saved.id,
      ip: actor.ip,
      metadata: { provider: PROVIDER, changed, mode: saved.mode, isEnabled: saved.isEnabled },
    });
    return this.toView(saved);
  }

  /** Vuelve a validar las credenciales guardadas y registra el resultado. */
  async verify(actor: Actor): Promise<{ ok: boolean; view: GatewayView }> {
    const current = await this.find();
    if (!current?.accessTokenEnc) throw new ConflictException('Todavía no cargaste un Access Token.');

    let ok = true;
    let patch: Prisma.PaymentGatewayUncheckedUpdateInput;
    try {
      const account = await this.mercadoPago.verifyCredentials({ accessToken: this.box.decrypt(current.accessTokenEnc), mode: current.mode });
      patch = { ...this.accountFields(account), lastError: null };
    } catch (error) {
      ok = false;
      const gatewayError = error instanceof GatewayError ? error : null;
      patch = {
        lastError: gatewayError ? MESSAGES[gatewayError.kind] : 'No se pudo validar el Access Token guardado.',
        // Credenciales rotas: se frena el cobro en vez de dejar que cada pedido falle.
        ...(gatewayError?.kind === 'invalid_credentials' && { isEnabled: false }),
      };
    }

    const saved = await this.prisma.paymentGateway.update({ where: { provider: PROVIDER }, data: { ...patch, updatedById: actor.id } });
    await this.audit.record({
      actorId: actor.id,
      action: 'payment_gateway.verified',
      entity: 'payment_gateway',
      entityId: saved.id,
      ip: actor.ip,
      metadata: { provider: PROVIDER, ok },
    });
    return { ok, view: this.toView(saved) };
  }

  /** Borra las credenciales y desactiva los cobros. */
  async disconnect(actor: Actor): Promise<GatewayView> {
    const current = await this.find();
    if (!current) return this.toView(null);

    const saved = await this.prisma.paymentGateway.update({
      where: { provider: PROVIDER },
      data: {
        isEnabled: false,
        accessTokenEnc: null,
        webhookSecretEnc: null,
        publicKey: null,
        accountId: null,
        accountLabel: null,
        siteId: null,
        lastVerifiedAt: null,
        lastError: null,
        updatedById: actor.id,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'payment_gateway.disconnected',
      entity: 'payment_gateway',
      entityId: saved.id,
      ip: actor.ip,
      metadata: { provider: PROVIDER },
    });
    return this.toView(saved);
  }

  /** Credenciales descifradas de la pasarela activa, para el checkout y los webhooks. `null` si no se puede cobrar. */
  async getActive(): Promise<ActiveGateway | null> {
    const record = await this.find();
    if (!record?.isEnabled || !record.accessTokenEnc || !record.webhookSecretEnc) return null;
    return {
      accessToken: this.box.decrypt(record.accessTokenEnc),
      mode: record.mode,
      webhookSecret: this.box.decrypt(record.webhookSecretEnc),
    };
  }

  /**
   * Access Token para consultar pagos, aunque los cobros estén pausados: un pago iniciado antes de la pausa
   * igual tiene que poder conciliarse.
   */
  async getCredentials(): Promise<GatewayCredentials | null> {
    const record = await this.find();
    return record?.accessTokenEnc ? { accessToken: this.box.decrypt(record.accessTokenEnc), mode: record.mode } : null;
  }

  /** Clave de los webhooks, aunque los cobros estén pausados: los avisos pendientes igual deben poder validarse. */
  async getWebhookSecret(): Promise<string | null> {
    const record = await this.find();
    return record?.webhookSecretEnc ? this.box.decrypt(record.webhookSecretEnc) : null;
  }

  /**
   * Crea o actualiza la fila. No se usa `upsert`: Prisma lo traduce a `INSERT … ON CONFLICT` y PostgreSQL
   * evalúa los CHECK sobre la fila propuesta antes de resolver el conflicto, así que un parche parcial
   * (p. ej. solo `is_enabled`) fallaría aunque la fila existente sea válida.
   */
  private async persist(current: GatewayRecord | null, data: Prisma.PaymentGatewayUncheckedCreateInput): Promise<GatewayRecord> {
    const { provider, ...patch } = data;
    if (current) return this.prisma.paymentGateway.update({ where: { provider }, data: patch });

    try {
      return await this.prisma.paymentGateway.create({ data });
    } catch (error) {
      // Dos primeras cargas simultáneas: la otra ganó; se aplica este cambio sobre su fila.
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.paymentGateway.update({ where: { provider }, data: patch });
    }
  }

  private find(): Promise<GatewayRecord | null> {
    return this.prisma.paymentGateway.findUnique({ where: { provider: PROVIDER } });
  }

  private async verifyOrThrow(accessToken: string, mode: PaymentMode): Promise<GatewayAccount> {
    try {
      return await this.mercadoPago.verifyCredentials({ accessToken, mode });
    } catch (error) {
      if (!(error instanceof GatewayError)) throw error;
      if (error.kind === 'unavailable') throw new ServiceUnavailableException(MESSAGES.unavailable);
      throw new UnprocessableEntityException(error.kind === 'rejected' ? `${MESSAGES.rejected} ${error.message}` : MESSAGES[error.kind]);
    }
  }

  private accountFields(account: GatewayAccount) {
    return { accountId: account.id, accountLabel: account.label, siteId: account.siteId, lastVerifiedAt: new Date() };
  }

  private assertCanEnable(next: GatewayRecord): void {
    if (!next.accessTokenEnc) throw new ConflictException('Para activar los cobros primero cargá el Access Token.');
    if (!next.webhookSecretEnc) {
      throw new ConflictException('Para activar los cobros cargá también la clave secreta del webhook: sin ella no podemos confirmar los pagos.');
    }
    if (!next.lastVerifiedAt || next.lastError) throw new ConflictException('Las credenciales no están validadas. Probá la conexión antes de activar.');
  }

  private toView(record: GatewayRecord | null): GatewayView {
    const accessToken = record?.accessTokenEnc ? this.box.decrypt(record.accessTokenEnc) : null;
    const webhookSecret = record?.webhookSecretEnc ? this.box.decrypt(record.webhookSecretEnc) : null;
    const verified = Boolean(record?.lastVerifiedAt && !record.lastError);

    return {
      provider: PROVIDER,
      isEnabled: record?.isEnabled ?? false,
      mode: record?.mode ?? 'SANDBOX',
      publicKey: record?.publicKey ?? null,
      hasAccessToken: accessToken !== null,
      accessTokenHint: accessToken && hint(accessToken),
      hasWebhookSecret: webhookSecret !== null,
      webhookSecretHint: webhookSecret && hint(webhookSecret),
      account: record?.accountId ? { id: record.accountId, label: record.accountLabel ?? record.accountId, siteId: record.siteId } : null,
      lastVerifiedAt: record?.lastVerifiedAt ?? null,
      lastError: record?.lastError ?? null,
      ready: Boolean(record?.isEnabled && verified && webhookSecret),
      webhookUrl: `${this.config.PUBLIC_API_URL}${WEBHOOK_PATH}`,
      updatedAt: record?.updatedAt ?? null,
    };
  }
}
