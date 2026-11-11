import {
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

@ApiExcludeController()
@Public()
@Controller('local-storage')
export class LocalStorageController {
  constructor(private readonly storage: StorageService) {}

  @Put('put/:ticket')
  @HttpCode(200)
  async put(@Param('ticket') ticket: string, @Req() req: Request) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const contentTypeHeader = req.headers['content-type'];
    const contentType =
      typeof contentTypeHeader === 'string'
        ? contentTypeHeader.split(';')[0]?.trim()
        : undefined;
    const objectKey = await this.storage.putFromTicket(
      ticket,
      Buffer.concat(chunks),
      contentType,
    );
    return { objectKey };
  }

  @Get('objects/institutions/:institutionId/:folder/:file')
  async getObject(
    @Param('institutionId') institutionId: string,
    @Param('folder') folder: string,
    @Param('file') file: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `institutions/${institutionId}/${folder}/${file}`;
    await this.sendObject(key, res);
  }

  @Get('objects/platform/app-branding/:appKey/:purpose/:file')
  async getBrandingObject(
    @Param('appKey') appKey: string,
    @Param('purpose') purpose: string,
    @Param('file') file: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `platform/app-branding/${appKey}/${purpose}/${file}`;
    await this.sendObject(key, res);
  }

  private async sendObject(key: string, res: Response): Promise<void> {
    const { buffer, contentType } = await this.storage.readPublicObject(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }
}
