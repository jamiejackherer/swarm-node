export interface TestCase {
    description: string;
    expected_assistant: string;
    groundtruth?: string;
    expected_plan?: string;
    iterate?: boolean;
    evaluate?: boolean;
    eval_function?: string;
}
