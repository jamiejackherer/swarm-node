import { queryDocs } from '../src/tools/queryDocs';
import console from 'console';

interface QueryDocsResponse {
    response: string;
}

async function testQueries() {
    const queries = [
        "What is AI Chatbot Pro?",
        "How do I set up the chatbot?",
        "Tell me about pricing",
        "What are the best practices?",
    ];

    console.log('Testing queryDocs tool...\n');

    for (const query of queries) {
        console.log(`Query: "${query}"`);
        const result = await queryDocs.function([{ query }]) as QueryDocsResponse;
        console.log('Response:', result.response);
        console.log('---\n');
    }
}

testQueries().catch(console.error);
