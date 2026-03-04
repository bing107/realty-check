import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: 'images array required' }, { status: 400 });
  }

  const apiKey = req.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required. Provide your Anthropic key via the X-API-Key header.' },
      { status: 401 },
    );
  }

  const images: string[] = body.images;

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((dataUrl) => {
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: base64Data,
      },
    };
  });

  const client = new Anthropic({ apiKey });

  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: 'Extract all text visible in these document pages. Return only the raw text, preserving paragraph breaks. Do not add commentary.',
            },
          ],
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const content = message.content[0];
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 });
  }

  return NextResponse.json({ text: content.text });
}
