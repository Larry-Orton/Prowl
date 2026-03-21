/**
 * AI proxy — routes Claude API calls through the main process so the API key
 * never touches the renderer or DevTools network tab.
 */
import { net } from 'electron';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_API_URL } from '../shared/constants';
import { getApiKey } from '../db/client';

interface APIMessage {
  role: string;
  content: string;
}

export async function sendToAI(
  messages: APIMessage[],
  systemPrompt: string
): Promise<string> {
  const key = getApiKey();
  if (!key) {
    throw new Error('No API key configured. Please set your Anthropic API key.');
  }

  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: CLAUDE_API_URL,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('x-api-key', key);
    request.setHeader('anthropic-version', '2023-06-01');

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        if (response.statusCode !== 200) {
          let errMsg = `API error ${response.statusCode}`;
          try {
            const parsed = JSON.parse(responseData);
            errMsg = parsed.error?.message ?? errMsg;
          } catch {
            // use default error
          }
          reject(new Error(errMsg));
          return;
        }

        try {
          const data = JSON.parse(responseData);
          const text = data.content?.[0]?.text ?? 'No response';
          resolve(text);
        } catch {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    request.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    request.write(body);
    request.end();
  });
}
