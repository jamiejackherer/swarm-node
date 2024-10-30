import fs from 'fs';
import { OpenAI } from 'openai';
import { qdrantConfig } from '../src/config/qdrant';
import { setTimeout } from 'timers/promises';
import console from 'console';
import fetch from 'node-fetch';

const openai = new OpenAI();

interface DocCollection {
    name: string;
    file: string;
}

const collections: DocCollection[] = [
    { name: 'triage', file: 'data/triage_docs.json' },
    { name: 'sales', file: 'data/sales_docs.json' },
    { name: 'refunds', file: 'data/refunds_docs.json' }
];

async function retry<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries === 0) throw error;
        console.log(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
        await setTimeout(delay);
        return retry(operation, retries - 1, delay * 2);
    }
}

async function createCollection(name: string, vectorSize: number) {
    const response = await fetch(`http://${qdrantConfig.host}:${qdrantConfig.port}/collections/${name}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            vectors: {
                size: vectorSize,
                distance: "Cosine"
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create collection: ${await response.text()}`);
    }

    return await response.json();
}

async function upsertPoint(collectionName: string, point: any) {
    const response = await fetch(`http://${qdrantConfig.host}:${qdrantConfig.port}/collections/${collectionName}/points?wait=true`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            points: [{
                id: point.id,
                vector: point.vector,
                payload: point.payload
            }]
        })
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('Qdrant Error Response:', text);
        throw new Error(`Failed to upsert point: ${text}`);
    }

    return await response.json();
}

async function loadAndStoreDocs() {
    try {
        for (const collection of collections) {
            console.log(`\nProcessing collection: ${collection.name}`);

            // Delete existing collection if it exists
            await fetch(`http://${qdrantConfig.host}:${qdrantConfig.port}/collections/${collection.name}`, {
                method: 'DELETE'
            });

            // Load and process the documents
            const data = JSON.parse(fs.readFileSync(collection.file, 'utf-8'));
            console.log(`Loading ${data.length} documents...`);

            const firstEmbedding = await openai.embeddings.create({
                input: data[0].text,
                model: qdrantConfig.embeddingModel
            });

            const vectorSize = firstEmbedding.data[0].embedding.length;
            console.log(`Creating collection with vector size: ${vectorSize}`);

            // Create collection with correct vector size
            await createCollection(collection.name, vectorSize);

            // Process all documents
            for (let i = 0; i < data.length; i++) {
                const doc = data[i];
                console.log(`Processing document: ${doc.title}`);

                const embeddingResponse = await retry(() => openai.embeddings.create({
                    input: doc.text,
                    model: qdrantConfig.embeddingModel
                }));

                const embedding = embeddingResponse.data[0].embedding;
                const pointId = i + 1;

                const point = {
                    id: pointId,
                    vector: embedding,
                    payload: {
                        title: doc.title,
                        text: doc.text,
                        url: doc.url
                    }
                };

                console.log('Sending point to Qdrant:', {
                    id: pointId,
                    vectorSize: embedding.length
                });

                await upsertPoint(collection.name, point);
                console.log(`Stored document: ${doc.title}`);
            }

            console.log(`Collection ${collection.name} loaded successfully!`);
        }

        console.log('\nAll collections loaded successfully!');
    } catch (error) {
        console.error('Error loading documents:', error);
        throw error;
    }
}

// Run the script
loadAndStoreDocs().catch(console.error);
