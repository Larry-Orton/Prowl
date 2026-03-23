/**
 * AI proxy — routes Claude API calls through the main process so the API key
 * never touches the renderer or DevTools network tab.
 * Supports tool_use for web search.
 */
import { net } from 'electron';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_API_URL } from '../shared/constants';
import { getApiKey } from '../db/client';

interface APIMessage {
  role: string;
  content: string | any[];
}

// ── Web Search Tool Definition ────────────────────

const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information about exploits, CVEs, vulnerabilities, tools, techniques, or any other topic. Use this when you need up-to-date information beyond your training data.',
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

// ── Web Search Implementation ─────────────────────

async function webSearch(query: string): Promise<string> {
  // Use DuckDuckGo HTML search — no API key needed
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
          // Extract search result snippets from DuckDuckGo HTML
          const results: string[] = [];
          const resultPattern = /<a rel="nofollow" class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
          const snippetPattern = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

          let match;
          const urls: string[] = [];
          const titles: string[] = [];
          while ((match = resultPattern.exec(html)) !== null && titles.length < 8) {
            urls.push(match[1].replace(/&amp;/g, '&'));
            titles.push(match[2].replace(/<[^>]*>/g, '').trim());
          }

          const snippets: string[] = [];
          while ((match = snippetPattern.exec(html)) !== null && snippets.length < 8) {
            snippets.push(match[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim());
          }

          for (let i = 0; i < titles.length; i++) {
            results.push(`[${i + 1}] ${titles[i]}\n${snippets[i] || ''}\nURL: ${urls[i] || ''}\n`);
          }

          resolve(results.length > 0
            ? results.join('\n')
            : 'No search results found.');
        } catch {
          resolve('Failed to parse search results.');
        }
      });
    });
    request.on('error', () => {
      resolve('Web search failed — network error.');
    });
    request.end();
  });
}

// ── Claude API Call ───────────────────────────────

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
          } catch { /* use default */ }
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

// ── Main Export ───────────────────────────────────

export async function sendToAI(
  messages: APIMessage[],
  systemPrompt: string
): Promise<string> {
  const key = getApiKey();
  if (!key) {
    throw new Error('No API key configured. Please set your Anthropic API key.');
  }

  // First call — include web_search tool
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: systemPrompt,
    messages,
    tools: [WEB_SEARCH_TOOL],
  });

  let data: any;
  try {
    data = await callClaude(body, key);
  } catch (err) {
    throw err;
  }

  // Helper to extract text from response content blocks
  const extractText = (content: any[]): string => {
    if (!content || !Array.isArray(content)) {
      return `DEBUG: content is not an array: ${JSON.stringify(content).slice(0, 300)}`;
    }
    const text = content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    if (!text) {
      return `DEBUG: No text blocks found. Content: ${JSON.stringify(content).slice(0, 500)}`;
    }
    return text;
  };

  // Check if Claude wants to use the web_search tool
  if (data.stop_reason === 'tool_use') {
    const toolBlocks = data.content.filter((b: any) => b.type === 'tool_use');
    const prefixText = extractText(data.content);

    // Execute all tool calls
    const toolResults: any[] = [];
    for (const tool of toolBlocks) {
      if (tool.name === 'web_search') {
        try {
          const searchResults = await webSearch(tool.input.query);
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
      }
    }

    // Second call — send tool results back to Claude for final answer
    try {
      const followUp = JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'assistant', content: data.content },
          { role: 'user', content: toolResults },
        ],
        tools: [WEB_SEARCH_TOOL],
      });

      const finalData = await callClaude(followUp, key);
      const finalText = extractText(finalData.content);
      // If still debug output, add more context
      if (finalText.startsWith('DEBUG:')) {
        return `First call stop_reason: ${data.stop_reason}\nTool used: ${toolBlocks.map((t: any) => `${t.name}(${JSON.stringify(t.input)})`).join(', ')}\nSearch results preview: ${toolResults[0]?.content?.slice(0, 200) || 'none'}\n\nSecond call: ${finalText}\nSecond call stop_reason: ${finalData.stop_reason}\nFull second response: ${JSON.stringify(finalData).slice(0, 500)}`;
      }
      const prefix = prefixText !== 'No response from AI.' ? prefixText + '\n\n' : '';
      return prefix + finalText;
    } catch (err) {
      // If follow-up fails, return whatever prefix text we got
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return prefixText !== 'No response from AI.'
        ? prefixText + `\n\n(Web search completed but follow-up failed: ${msg})`
        : `Web search failed: ${msg}`;
    }
  }

  // No tool use — return text directly
  return extractText(data.content);
}
