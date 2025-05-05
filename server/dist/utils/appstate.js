"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appState = exports.AppStateManager = void 0;
/**
 * Global application state management
 * Used to track application-level state and share resources
 */
class AppStateManager {
    static _instance;
    // Application state properties
    _associationsInitialized = false;
    _io = null;
    _fieldMappings = {
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
    _enableGlobalMapping = true;
    _config = {
        enableGracefulDegradation: true,
        enableFieldMapping: true,
        enableConsistencyChecks: true
    };
    constructor() {
        // Private constructor to prevent direct instantiation
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!AppStateManager._instance) {
            AppStateManager._instance = new AppStateManager();
        }
        return AppStateManager._instance;
    }
    // Getters and setters
    get associationsInitialized() {
        return this._associationsInitialized;
    }
    set associationsInitialized(value) {
        this._associationsInitialized = value;
    }
    get io() {
        return this._io;
    }
    set io(value) {
        this._io = value;
    }
    get fieldMappings() {
        return this._fieldMappings;
    }
    get enableGlobalMapping() {
        return this._enableGlobalMapping;
    }
    set enableGlobalMapping(value) {
        this._enableGlobalMapping = value;
    }
    get config() {
        return this._config;
    }
    /**
     * Reset the application state to initial values
     * Mainly used for testing purposes
     */
    reset() {
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
exports.AppStateManager = AppStateManager;
// Export singleton instance
exports.appState = AppStateManager.getInstance();
