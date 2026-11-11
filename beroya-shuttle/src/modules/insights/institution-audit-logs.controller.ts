import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs.query';

@ApiTags('institution-audit')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/audit-logs')
export class InstitutionAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Institution-scoped audit log' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: AuditLogsQueryDto,
  ) {
    return this.auditLogs.listInstitution(institutionId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One institution audit log entry' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auditLogs.getInstitution(institutionId, id);
  }
}
