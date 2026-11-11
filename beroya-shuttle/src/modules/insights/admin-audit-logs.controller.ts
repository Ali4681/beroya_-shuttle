import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { AdminAuditLogsQueryDto } from './dto/audit-logs.query';

@ApiTags('admin-audit')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Platform audit log (optional institution filter)' })
  list(@Query() query: AdminAuditLogsQueryDto) {
    return this.auditLogs.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One audit log entry' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditLogs.getAdmin(id);
  }
}
