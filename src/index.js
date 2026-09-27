export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.includes('/api/') && request.method === 'POST') {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/$/, '');

  if (!path.endsWith('/api/generate-cover-letter')) {
    return json({ error: 'Not found' }, 404);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.AI_RATE_LIMITER.limit({ key: 'cover-letter:' + ip });

  if (!success) {
    return json({
      error: 'Too many requests. Please wait a minute and try again.',
      code: 'RATE_LIMITED'
    }, 429);
  }

  return handleGenerate(request, env);
}

const LENGTH_PROMPTS = {
  short: 'Write a concise cover letter of 2-3 short paragraphs. Keep it under 200 words. Focus on the single strongest fit between the candidate and the role.',
  medium: 'Write a cover letter of 4-5 paragraphs. Around 300-350 words. Cover the candidate\'s background, relevant experience, why this role, and a closing with a call to action.',
  long: 'Write a detailed cover letter of 5-6 paragraphs. Around 450-500 words. Include specific examples, measurable achievements, and a clear narrative connecting the candidate\'s background to the role.'
};

const STYLE_PROMPTS = {
  standard: 'Use a standard professional business tone. Clear, formal, and confident.',
  conversational: 'Use a warm, conversational tone. Sound like a real person, not a template. Use contractions and natural language.',
  achievement: 'Lead with measurable achievements. Every paragraph should include at least one specific result, number, or outcome.',
  career_change: 'The candidate is changing careers. Frame past experience as a strength, not a gap. Emphasize transferable skills and motivation.'
};

async function handleGenerate(request, env) {
  try {
    const body = await request.json();
    const jobTitle = (body.job_title || '').trim();
    const company = (body.company || '').trim();
    const jobDescription = (body.job_description || '').trim();
    const background = (body.background || '').trim();
    const length = body.length || 'medium';
    const style = body.style || 'standard';

    if (!jobTitle || !background) {
      return json({ error: 'Job title and background are required.' }, 400);
    }

    if (background.length < 50) {
      return json({ error: 'Background must be at least 50 characters.' }, 400);
    }

    const MAX_CHARS = 4000;
    const trimmedJobDesc = jobDescription.length > MAX_CHARS ? jobDescription.slice(0, MAX_CHARS) : jobDescription;
    const trimmedBg = background.length > MAX_CHARS ? background.slice(0, MAX_CHARS) : background;

    const systemPrompt = 'You are an expert career coach who writes tailored cover letters. You output ONLY the cover letter text, with no preamble, no explanations, no placeholders like [Your Name]. Write in complete sentences. Do not include headers or dates.';

    let userPrompt = '';
    userPrompt += 'Role: ' + jobTitle + '\n';
    if (company) userPrompt += 'Company: ' + company + '\n';
    userPrompt += '\n';

    if (trimmedJobDesc) {
      userPrompt += 'Job description:\n' + trimmedJobDesc + '\n\n';
    }

    userPrompt += 'Candidate background:\n' + trimmedBg + '\n\n';

    userPrompt += 'Instructions:\n';
    userPrompt += '- ' + (LENGTH_PROMPTS[length] || LENGTH_PROMPTS.medium) + '\n';
    userPrompt += '- ' + (STYLE_PROMPTS[style] || STYLE_PROMPTS.standard) + '\n';
    userPrompt += '- Do NOT invent specific numbers, employers, or achievements that were not in the candidate background.\n';
    userPrompt += '- Do NOT use generic phrases like "I am writing to express my interest." Start with something specific.\n';
    userPrompt += '- End with a clear, confident call to action.\n';
    userPrompt += '\nWrite the cover letter now.';

    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.6
    });

    const output = (response.response || '').trim();

    if (!output) {
      return json({ error: 'Model returned empty output. Please try again.' }, 500);
    }

    return json({ output: output });
  } catch (err) {
    console.error('Generate error:', err);
    return json({ error: 'Processing failed. Please try again in a moment.' }, 500);
  }
}
