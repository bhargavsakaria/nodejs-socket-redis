import CallHistory from '../entities/CallHistory.postgres';
import { EntityRepository, Repository } from 'typeorm';

@EntityRepository(CallHistory)
export class CallHistoryRepository extends Repository<CallHistory> {
  // public async
}
