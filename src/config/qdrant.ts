import process from 'process';

export const qdrantConfig = {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333', 10),
    collection: process.env.QDRANT_COLLECTION || 'help_center',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-large'
} as const;
