import { Tool } from '../types/Tool';
import { QdrantClient } from '@qdrant/qdrant-js';
import { OpenAI } from 'openai';
import { qdrantConfig } from '../config/qdrant';
import { queryDocsSchema } from '../schemas/tools/queryDocs';
import { QueryParams } from '../types/QueryParams';
import console from 'console';

// Initialize connections
const openai = new OpenAI();
const qdrant = new QdrantClient({
    host: qdrantConfig.host,
    port: qdrantConfig.port
});

async function queryQdrant(query: string, collection: string) {
    const embedded_query = await openai.embeddings.create({
        input: query,
        model: qdrantConfig.embeddingModel
    });

    return await qdrant.search(collection, {
        vector: embedded_query.data[0].embedding,
        limit: 5
    });
}

function isQueryParams(obj: unknown): obj is QueryParams {
    return typeof obj === 'object' &&
        obj !== null &&
        'query' in obj &&
        (typeof (obj as QueryParams).query === 'string') &&
        (!('collection' in obj) || typeof (obj as QueryParams).collection === 'string');
}

export const queryDocs: Tool = {
    name: "query_docs",  // Add the required name property
    schema: queryDocsSchema,
    function: async (...args: unknown[]): Promise<{ response: string }> => {
        // Add this test
        console.log("QueryDocs tool called with:", args);
        const params = args[0];
        if (!isQueryParams(params)) {
            return { response: 'Invalid query parameters.' };
        }

        const query = params.query;
        const collection = params.collection || 'triage';
        console.log(`Searching ${collection} knowledge base with query: ${query}`);

        try {
            const queryResults = await queryQdrant(query, collection);
            if (queryResults.length > 0) {
                const [firstResult] = queryResults;
                const response = firstResult.payload ?
                    `Title: ${firstResult.payload.title}\nContent: ${firstResult.payload.text}` :
                    'No content found in the result.';
                return { response };
            }
            return { response: 'No results found.' };
        } catch (error) {
            console.error('Error querying docs:', error);
            return { response: 'Error querying documentation.' };
        }
    }
};
