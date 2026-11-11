import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { LegalQueryDto } from './dto/legal-query.dto';
import { LegalService } from './legal.service';

@ApiTags('legal')
@Controller('public/legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List privacy policy and terms of use document metadata',
  })
  list(@Query() query: LegalQueryDto) {
    return this.legal.list(query.locale);
  }

  @Public()
  @Get('privacy-policy')
  @ApiOperation({ summary: 'Privacy policy content (markdown + html)' })
  privacyPolicy(@Query() query: LegalQueryDto) {
    return this.legal.get('privacy_policy', query.locale);
  }

  @Public()
  @Get('terms-of-use')
  @ApiOperation({ summary: 'Terms of use content (markdown + html)' })
  termsOfUse(@Query() query: LegalQueryDto) {
    return this.legal.get('terms_of_use', query.locale);
  }

  @Public()
  @Get('data-deletion')
  @ApiProduces('text/html')
  @ApiOperation({
    summary:
      'Public HTML page for Google Play data deletion request URL (no auth)',
  })
  dataDeletion(@Query() query: LegalQueryDto, @Res() res: Response) {
    const html = this.legal.dataDeletionHtml(query.locale);
    res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      // Allow inline CSS for this static informational page (helmet defaults block it).
      .setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      )
      .send(html);
  }
}
