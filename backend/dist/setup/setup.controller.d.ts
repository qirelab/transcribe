import { DatabaseService } from '../database/database.service';
export declare class SetupController {
    private readonly dbService;
    constructor(dbService: DatabaseService);
    getStatus(): {
        hasApiKey: boolean;
    };
    configure(body: {
        apiKey: string;
    }): {
        success: boolean;
    };
}
