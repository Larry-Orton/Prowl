/**
 * AI proxy — routes Claude API calls through the main process so the API key
 * never touches the renderer or DevTools network tab.
 * Supports iterative tool_use for web search.
 */
import { net } from 'electron';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_API_URL } from '../shared/constants';
import { getApiKey } from '../db/client';

interface APIMessage {
  role: string;
  content: string | any[];
}

const MAX_TOOL_ROUNDS = 6;

const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information about exploits, CVEs, vulnerabilities, tools, techniques, walkthroughs, or any other topic where up-to-date information is useful.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },
};

const WEB_FETCH_TOOL = {
  name: 'web_fetch',
  description: 'Fetch the readable text content of a web page from a URL. Use this after web_search when you need the actual article or walkthrough content, not just search snippets.',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The full http or https URL to fetch',
      },
    },
    required: ['url'],
  },
};

async function webSearch(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

  return new Promise((resolve) => {
    const request = net.request({ method: 'GET', url });
    request.setHeader('User-Agent', 'Mozilla/5.0 (compatible; Prowl/1.0)');

    let html = '';
    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        html += chunk.toString();
      });
      response.on('end', () => {
        try {
          const results: string[] = [];
          const resultPattern = /<a rel="nofollow" class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
          const snippetPattern = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

          let match;
          const urls: string[] = [];
          const titles: string[] = [];
          while ((match = resultPattern.exec(html)) !== null && titles.length < 8) {
            urls.push(match[1].replace(/&amp;/g, '&'));
            titles.push(
              match[2]
                .replace(/<[^>]*>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim()
            );
          }

          const snippets: string[] = [];
          while ((match = snippetPattern.exec(html)) !== null && snippets.length < 8) {
            snippets.push(
              match[1]
                .replace(/<[^>]*>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim()
            );
          }

          for (let i = 0; i < titles.length; i++) {
            results.push(`[${i + 1}] ${titles[i]}\n${snippets[i] || ''}\nURL: ${urls[i] || ''}`);
          }

          resolve(results.length > 0 ? results.join('\n\n') : 'No search results found.');
        } catch {
          resolve('Failed to parse search results.');
        }
      });
    });

    request.on('error', () => {
      resolve('Web search failed - network error.');
    });

    request.end();
  });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function webFetch(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Web fetch failed: invalid URL.';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'Web fetch failed: only http and https URLs are supported.';
  }

  return new Promise((resolve) => {
    const request = net.request({ method: 'GET', url: parsed.toString() });
    request.setHeader('User-Agent', 'Mozilla/5.0 (compatible; Prowl/1.0)');

    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      response.on('end', () => {
        try {
          const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : parsed.hostname;
          const text = decodeHtmlEntities(
            body
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
              .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          );

          if (!text) {
            resolve(`Fetched ${parsed.toString()} but no readable text was extracted.`);
            return;
          }

          resolve(`TITLE: ${title}\nURL: ${parsed.toString()}\nCONTENT:\n${text.slice(0, 12000)}`);
        } catch {
          resolve('Web fetch failed: unable to parse page content.');
        }
      });
    });

    request.on('error', () => {
      resolve('Web fetch failed - network error.');
    });

    request.end();
  });
}

function callClaude(body: string, key: string): Promise<any> {
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
            // keep default error
          }
          reject(new Error(errMsg));
          return;
        }

        try {
          resolve(JSON.parse(responseData));
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

function extractText(content: any[] | undefined): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

async function executeToolBlocks(toolBlocks: any[]): Promise<any[]> {
  const toolResults: any[] = [];

  for (const tool of toolBlocks) {
    if (tool.name === 'web_search') {
      const query = typeof tool.input?.query === 'string' ? tool.input.query.trim() : '';
      if (!query) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: 'Web search failed: missing query.',
          is_error: true,
        });
        continue;
      }

      try {
        const searchResults = await webSearch(query);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: searchResults,
        });
      } catch {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: 'Web search failed.',
          is_error: true,
        });
      }
      continue;
    }

    if (tool.name === 'web_fetch') {
      const url = typeof tool.input?.url === 'string' ? tool.input.url.trim() : '';
      if (!url) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: 'Web fetch failed: missing URL.',
          is_error: true,
        });
        continue;
      }

      try {
        const pageContent = await webFetch(url);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: pageContent,
        });
      } catch {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: 'Web fetch failed.',
          is_error: true,
        });
      }
      continue;
    }

    toolResults.push({
      type: 'tool_result',
      tool_use_id: tool.id,
      content: `Unsupported tool: ${tool.name}`,
      is_error: true,
    });
  }

  return toolResults;
}

async function runClaudeWithTools(messages: APIMessage[], systemPrompt: string, key: string): Promise<string> {
  const conversation: APIMessage[] = [...messages];
  const accumulatedText: string[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: systemPrompt,
      messages: conversation,
      tools: [WEB_SEARCH_TOOL, WEB_FETCH_TOOL],
    });

    const data = await callClaude(body, key);
    const content = Array.isArray(data.content) ? data.content : [];
    const text = extractText(content);
    if (text) {
      accumulatedText.push(text);
    }

    const toolBlocks = content.filter((block: any) => block?.type === 'tool_use');
    if (toolBlocks.length === 0) {
      const finalText = accumulatedText.join('\n\n').trim();
      if (finalText) {
        return finalText;
      }
      throw new Error('AI returned no readable text.');
    }

    if (round === MAX_TOOL_ROUNDS) {
      const partialText = accumulatedText.join('\n\n').trim();
      if (partialText) {
        return `${partialText}\n\nProwl stopped after multiple web-tool rounds without a final answer. Try narrowing the request.`;
      }
      throw new Error('AI kept requesting web tools without producing a final answer.');
    }

    const toolResults = await executeToolBlocks(toolBlocks);

    // On the second-to-last round, tell Claude to wrap up
    if (round === MAX_TOOL_ROUNDS - 1) {
      toolResults.push({
        type: 'text',
        text: 'IMPORTANT: You have used several tool rounds. Please provide your final answer now based on what you have gathered so far. Do not call any more tools.',
      });
    }

    conversation.push(
      { role: 'assistant', content },
      { role: 'user', content: toolResults }
    );
  }

  throw new Error('AI tool loop ended unexpectedly.');
}

export async function sendToAI(messages: APIMessage[], systemPrompt: string): Promise<string> {
  const key = getApiKey();
  if (!key) {
    throw new Error('No API key configured. Please set your Anthropic API key.');
  }

  return runClaudeWithTools(messages, systemPrompt, key);
}
