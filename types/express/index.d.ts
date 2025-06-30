import { User } from '../../shared/schema';
import { IStorage } from '../../server/storage';
import { downloadService } from '../../server/services/downloadService';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
      storage: IStorage;
      downloadService: typeof downloadService;
    }
  }
}

// This is required to make this file a module
export {};