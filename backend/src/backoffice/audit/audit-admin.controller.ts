import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ListAuditQuery, listAuditSchema } from './audit-admin.schemas';
import { AuditAdminService } from './audit-admin.service';

/** Registro de acciones sensibles. Solo el SUPERADMIN. */
@Roles('SUPERADMIN')
@Controller('backoffice/audit')
export class AuditAdminController {
  constructor(private readonly audit: AuditAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listAuditSchema)) query: ListAuditQuery) {
    return this.audit.list(query);
  }

  @Get('facets')
  facets() {
    return this.audit.facets();
  }
}
