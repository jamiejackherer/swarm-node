import { v4 as uuidv4 } from 'uuid';

export interface TaskConfig {
    description: string;
    iterate?: boolean;
    evaluate?: boolean;
    assistant?: string;
}

export class Task {
    readonly id: string;
    description: string;
    assistant: string;
    iterate: boolean;
    evaluate: boolean;

    constructor(config: TaskConfig) {
        this.id = uuidv4();
        this.description = config.description;
        this.assistant = config.assistant || 'user_interface';
        this.iterate = config.iterate || false;
        this.evaluate = config.evaluate || false;
    }
}

export interface EvaluationTaskConfig extends TaskConfig {
    groundtruth: string;
    expected_assistant: string;
    expected_plan?: string;
    eval_function?: string;
}

export class EvaluationTask extends Task {
    groundtruth: string;
    expected_assistant: string;
    expected_plan?: string;
    eval_function?: string;

    constructor(config: EvaluationTaskConfig) {
        super(config);
        this.groundtruth = config.groundtruth;
        this.expected_assistant = config.expected_assistant;
        this.expected_plan = config.expected_plan;
        this.eval_function = config.eval_function;
    }
}
