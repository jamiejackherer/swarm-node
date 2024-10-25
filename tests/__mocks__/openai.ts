const mockOpenAI = {
    ChatCompletion: {
        create: async () => ({
            // Mock response structure
            choices: [
                {
                    message: {
                        content: "Mocked response content"
                    }
                }
            ]
        })
    }
};

export default () => mockOpenAI;
