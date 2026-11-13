import http from 'node:http';

const port = Number(process.env.MOCK_OPENAI_PORT ?? 8008);
const expectedKey = process.env.MOCK_OPENAI_API_KEY ?? 'mock-local-only';
let requestCount = 0;

function sample(schema, key = 'field', depth = 0, source = '', defs = {}) {
  if (depth > 12 || !schema || typeof schema !== 'object') return null;
  if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#/$defs/')) {
    const refName = schema.$ref.slice('#/$defs/'.length).replaceAll('~1', '/').replaceAll('~0', '~');
    return sample(defs[refName], key, depth + 1, source, defs);
  }
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.anyOf?.length) return sample(schema.anyOf.find(item => item?.type !== 'null') ?? schema.anyOf[0], key, depth + 1, source, defs);
  if (schema.oneOf?.length) return sample(schema.oneOf.find(item => item?.type !== 'null') ?? schema.oneOf[0], key, depth + 1, source, defs);
  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, child]) => [name, sample(child, name, depth + 1, source, defs)]));
  }
  if (schema.type === 'array') {
    const count = Math.max(1, schema.minItems ?? 1);
    return Array.from({ length: Math.min(count, 30) }, () => sample(schema.items, key, depth + 1, source, defs));
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    const min = Number.isFinite(schema.minimum) ? schema.minimum : 0;
    const max = Number.isFinite(schema.maximum) ? schema.maximum : min + 1;
    const value = Math.max(min, Math.min(max, min));
    return schema.type === 'integer' ? Math.trunc(value) : value;
  }
  if (schema.type === 'boolean') return false;
  if (schema.type === 'null') return null;
  if (schema.type === 'string' || !schema.type) {
    const label = key.replaceAll('_', ' ');
    const min = schema.minLength ?? 0;
    const max = schema.maxLength ?? 1000;
    const heading = source.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
    const body = source.replace(/^\s*#\s+.+$/m, '').trim();
    let value = /title|heading/i.test(key) && heading
      ? heading
      : /note/i.test(key)
        ? `Synthetic/hypothetical note. ${body || heading || 'Local API and export verification only.'}`
        : body || heading || `Synthetic ${label} for local API and export verification.`;
    while (value.length < min) value += ' Synthetic test content.';
    return value.slice(0, max);
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', mode: 'deterministic synthetic stub' }));
  }
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404); return res.end('not found');
  }
  if (req.headers.authorization !== `Bearer ${expectedKey}`) {
    res.writeHead(401); return res.end('unauthorized');
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('invalid json'); }
  requestCount += 1;
  const format = body.response_format?.json_schema ?? body.response_format ?? {};
  const schema = format.schema ?? format.json_schema ?? {};
  const rawUserContent = body.messages?.findLast?.(message => message.role === 'user')?.content ?? '';
  const userText = typeof rawUserContent === 'string'
    ? rawUserContent
    : Array.isArray(rawUserContent)
      ? rawUserContent.map(part => typeof part === 'string' ? part : part?.text ?? '').join('\n')
      : JSON.stringify(rawUserContent);
  const slideSource = userText.match(/# SLIDE CONTENT: START\s*([\s\S]*?)\s*# SLIDE CONTENT: END/)?.[1] ?? userText;
  const generated = sample(schema, 'field', 0, slideSource, schema.$defs ?? {});
  const content = JSON.stringify(generated);
  const logEntry = {
    at: new Date().toISOString(), request: requestCount, path: req.url,
    model: body.model ?? null, schemaName: format.name ?? null,
    messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    schemaType: schema.type ?? null, schemaKeys: Object.keys(schema).slice(0, 12),
    propertyNames: Object.keys(schema.properties ?? {}).slice(0, 20), generatedType: Array.isArray(generated) ? 'array' : typeof generated, stream: Boolean(body.stream),
    responseBytes: Buffer.byteLength(content),
  };
  process.stdout.write(`${JSON.stringify(logEntry)}\n`);
  const response = {
    id: `chatcmpl-local-${requestCount}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000),
    model: body.model ?? 'synthetic-mock-v1',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const id = response.id;
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: response.created, model: response.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: response.created, model: response.model, choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: response.created, model: response.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    return res.end('data: [DONE]\n\n');
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(response));
});

server.listen(port, '0.0.0.0', () => process.stdout.write(`mock OpenAI-compatible API on :${port}; no model loaded\n`));
