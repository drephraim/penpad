import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.IMAGE_GEN_API_KEY
    const apiUrl = process.env.IMAGE_GEN_API_URL || "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"

    if (!apiKey) {
      return NextResponse.json({ error: "Image generation not configured. Set IMAGE_GEN_API_KEY and IMAGE_GEN_API_URL in your environment." }, { status: 501 })
    }

    const { prompt, negativePrompt } = await req.json()
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        text_prompts: [
          { text: prompt, weight: 1 },
          ...(negativePrompt ? [{ text: negativePrompt, weight: -1 }] : [])
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      return NextResponse.json({ error: `Image API error: ${response.status} ${errorData}` }, { status: response.status })
    }

    const data = await response.json()
    const imageBase64 = data.artifacts?.[0]?.base64

    if (!imageBase64) {
      return NextResponse.json({ error: "No image returned from API" }, { status: 502 })
    }

    return NextResponse.json({ imageUrl: `data:image/png;base64,${imageBase64}` })
  } catch (err) {
    console.error("Image generation error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Image generation failed" }, { status: 500 })
  }
}
