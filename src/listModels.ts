
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function listModels() {
  const apiKey = process.env.VITE_GEMINI_API_KEY_1 || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found.');
    return;
  }

  const genAI = new GoogleGenAI({ apiKey });
  try {
    const models = await genAI.models.list();
    console.log(JSON.stringify(models, null, 2));
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
