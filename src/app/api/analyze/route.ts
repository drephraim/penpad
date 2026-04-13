import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      console.error('GOOGLE_GENERATIVE_AI_API_KEY is not configured or still using placeholder');
      return NextResponse.json({ 
        error: 'Gemini API key is not configured. Please add your GOOGLE_GENERATIVE_AI_API_KEY to the .env file.' 
      }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const { text, action = 'analyze', tone = 'professional' } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let prompt = '';

    if (action === 'analyze') {
      prompt = `
        You are an expert copywriter, grammar coach, and literary editor. 
        Analyze the following text and find mistakes in grammar, spelling, or poor literary style.
        
        Respond ONLY with a JSON object in this exact structure, with an array called "suggestions":
        {
          "suggestions": [
            {
              "type": "grammar" | "spelling" | "style",
              "original": "the exact snippet of text with the error",
              "replacement": "the corrected or improved text",
              "explanation": "A short, 1 sentence explanation of why this was changed"
            }
          ]
        }
        
        If there are no mistakes, return exactly: {"suggestions": []}
        
        Text to analyze:
        """
        ${text}
        """
      `;
    } else if (action === 'summary') {
      prompt = `
        Summarize the following text into 3-5 concise, powerful bullet points. 
        Focus on key takeaways and actionable insights.
        
        Respond ONLY with a JSON object in this exact structure:
        {
          "summary": ["point 1", "point 2", "point 3"]
        }
        
        Text to summarize:
        """
        ${text}
        """
      `;
    } else if (action === 'refine') {
      prompt = `
        Rewrite the following text to have a ${tone} tone. 
        Make it high-quality, engaging, and polished while preserving the original meaning.
        
        Respond ONLY with a JSON object in this exact structure:
        {
          "refinedText": "the new version of the text"
        }
        
        Text to refine:
        """
        ${text}
        """
      `;
    }

    // Retry logic for temporary server errors (503 High Demand, 429 Rate Limit)
    let result;
    const retries = 3;
    let delay = 1000;

    for (let i = 0; i < retries; i++) {
      try {
        result = await model.generateContent(prompt);
        break; // Success!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('503') || error.message?.includes('429');
        if (isRetryable && i < retries - 1) {
          console.warn(`Gemini API busy (Status ${error.status}). Retrying attempt ${i + 1}/${retries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        throw error; // Permanent failure or max retries reached
      }
    }

    if (!result) throw new Error('Failed to generate content after multiple attempts');
    
    const response = await result.response;
    const resultText = response.text() || '{}';
    
    let data;
    try {
      // Clean potential markdown code blocks from response if LLM included them
      const cleanJson = resultText.replace(/^```json\n?|\n?```$/g, '');
      data = JSON.parse(cleanJson);
    } catch {
      console.error('Failed to parse JSON:', resultText);
      return NextResponse.json({ error: 'Failed to process AI response' });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; statusText?: string; stack?: string };
    console.error('AI Analysis Error:', {
      message: err.message,
      status: err.status,
      statusText: err.statusText,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: err.message || 'An error occurred during analysis.' },
      { status: err.status || 500 }
    );
  }
}
