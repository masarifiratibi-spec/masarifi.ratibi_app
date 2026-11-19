import { Controller, Delete, HttpCode, HttpException, Param, Req, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../identity/clerk-auth.guard';
import { PoolService } from '../platform/database/pool.service';
import { isReportUuid } from './reports.schemas';
import { ReportsStorage } from './reports.storage';

@Controller('api/v1/reports')
@UseGuards(ClerkAuthGuard)
export class QaReportFilesController {
  constructor(
    private readonly pool: PoolService,
    private readonly storage: ReportsStorage,
  ) {}

  @Delete(':attemptId')
  @HttpCode(204)
  async remove(
    @Req() request: ClerkPrincipalRequest,
    @Param('attemptId') id: string,
  ): Promise<void> {
    const principal = request.clerkPrincipal;
    if (!principal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    if (!isReportUuid(id)) throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    await this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({
            role: 'authenticated',
            sub: principal.userId,
            sid: principal.sessionId,
          }),
        ]);
        await client.query('set local role masarifi_api');
        const result = await client.query<{ outcome: string; object_key: string | null }>(
          'select outcome,object_key from private.expire_owned_qa_pdf($1::uuid)',
          [id],
        );
        const row = result.rows[0];
        if (row?.outcome === 'missing') throw new HttpException({ code: 'REPORT_NOT_FOUND' }, 404);
        if (row?.outcome === 'busy') throw new HttpException({ code: 'REPORT_NOT_READY' }, 409);
        if (row?.outcome !== 'expired') {
          if (
            row?.outcome !== 'remove' ||
            row.object_key !== this.storage.key(id, principal.userId, 'pdf')
          )
            throw new HttpException({ code: 'REPORT_STORAGE_UNAVAILABLE' }, 503);
          await this.storage.delete(row.object_key);
        }
        // Keep the worker lock until the object store confirms deletion or absence.
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        if (error instanceof HttpException) throw error;
        throw new HttpException({ code: 'REPORT_STORAGE_UNAVAILABLE' }, 503);
      }
    });
  }
}
