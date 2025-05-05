import { Server as SocketIOServer } from 'socket.io';

/**
 * Global application state management
 * Used to track application-level state and share resources
 */
export class AppStateManager {
  private static _instance: AppStateManager;
  
  // Application state properties
  private _associationsInitialized: boolean = false;
  private _io: SocketIOServer | null = null;
  private _fieldMappings: Record<string, string[]> = {
    // QuestionSet model mappings
    QuestionSet: ['title', 'name', 'setName', 'quizName'],
    
    // User model mappings
    User: ['username', 'userName', 'user_name', 'name'],
    
    // Question model mappings
    Question: ['text', 'content', 'question', 'questionText'],
    
    // Common ID mappings
    id: ['id', '_id', 'ID', 'uuid', 'uid'],
    
    // Common timestamp mappings
    createdAt: ['createdAt', 'created_at', 'createTime', 'create_time'],
    updatedAt: ['updatedAt', 'updated_at', 'updateTime', 'update_time'],
    
    // User Progress related mappings
    questionId: ['questionId', 'question_id'],
    questionSetId: ['questionSetId', 'question_set_id', 'setId', 'quizId'],
    userId: ['userId', 'user_id']
  };
  private _enableGlobalMapping: boolean = true;
  private _config = {
    enableGracefulDegradation: true,
    enableFieldMapping: true,
    enableConsistencyChecks: true
  };
  
  private constructor() {
    // Private constructor to prevent direct instantiation
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AppStateManager {
    if (!AppStateManager._instance) {
      AppStateManager._instance = new AppStateManager();
    }
    return AppStateManager._instance;
  }
  
  // Getters and setters
  
  get associationsInitialized(): boolean {
    return this._associationsInitialized;
  }
  
  set associationsInitialized(value: boolean) {
    this._associationsInitialized = value;
  }
  
  get io(): SocketIOServer | null {
    return this._io;
  }
  
  set io(value: SocketIOServer | null) {
    this._io = value;
  }
  
  get fieldMappings(): Record<string, string[]> {
    return this._fieldMappings;
  }
  
  get enableGlobalMapping(): boolean {
    return this._enableGlobalMapping;
  }
  
  set enableGlobalMapping(value: boolean) {
    this._enableGlobalMapping = value;
  }
  
  get config() {
    return this._config;
  }
  
  /**
   * Reset the application state to initial values
   * Mainly used for testing purposes
   */
  public reset(): void {
    this._associationsInitialized = false;
    this._io = null;
    this._enableGlobalMapping = true;
    this._config = {
      enableGracefulDegradation: true,
      enableFieldMapping: true,
      enableConsistencyChecks: true
    };
  }
}

// Export singleton instance
export const appState = AppStateManager.getInstance(); 