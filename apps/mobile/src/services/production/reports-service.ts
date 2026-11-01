import { createLiveReportsService } from '../live/reports-service';
import { ReportsRepository } from '@/storage/reports-repository';
export const reportsService = createLiveReportsService({
  repository: new ReportsRepository(true)
});
export {
  createLiveReportsService,
  ReportsApiError
} from '../live/reports-service';
