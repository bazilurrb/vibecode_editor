import { type NextRequest, NextResponse } from "next/server"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface EnhancePromptRequest {
  prompt: string
  context?: {
    fileName?: string
    language?: string
    codeContent?: string
  }
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "codellama:latest"
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120000 // 2 minutes timeout for local inference

async function generateAIResponse(messages: ChatMessage[]) {
  const systemPrompt = `You are an expert AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. When showing code, use proper formatting with language-specific syntax.
Keep responses concise but comprehensive. Use code blocks with language specification when providing code examples.`

  const fullMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages]

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // Prefer /api/chat endpoint with structured messages
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: fullMessages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 1500,
          repeat_penalty: 1.1,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // Fallback to /api/generate if /api/chat returned non-200
      const prompt = fullMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n\n")
      const fallbackResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 1500,
            repeat_penalty: 1.1,
          },
        }),
      })

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text()
        console.error("Error from AI model API:", errorText)
        throw new Error(`AI model API error: ${fallbackResponse.status} - ${errorText}`)
      }

      const fallbackData = await fallbackResponse.json()
      if (!fallbackData.response) {
        throw new Error("No response from AI model")
      }
      return {
        content: fallbackData.response.trim(),
        model: fallbackData.model || OLLAMA_MODEL,
        tokens: fallbackData.eval_count,
      }
    }

    const data = await response.json()
    const content = data.message?.content || data.response
    if (!content) {
      throw new Error("No response from AI model")
    }
    return {
      content: content.trim(),
      model: data.model || OLLAMA_MODEL,
      tokens: data.eval_count,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timeout: AI model took longer than ${TIMEOUT_MS / 1000}s to respond. If this is the first request, the model may still be loading into memory.`)
    }
    if (
      (error as any)?.code === "ECONNREFUSED" ||
      (error as Error)?.message?.includes("ECONNREFUSED") ||
      (error as Error)?.message?.includes("fetch failed")
    ) {
      throw new Error(`Could not connect to Ollama at ${OLLAMA_BASE_URL}. Please ensure Ollama is running on port 11434.`)
    }
    console.error("AI generation error:", error)
    throw error
  }
}

async function enhancePrompt(request: EnhancePromptRequest) {
  const enhancementPrompt = `You are a prompt enhancement assistant. Take the user's basic prompt and enhance it to be more specific, detailed, and effective for a coding AI assistant.

Original prompt: "${request.prompt}"

Context: ${request.context ? JSON.stringify(request.context, null, 2) : "No additional context"}

Enhanced prompt should:
- Be more specific and detailed
- Include relevant technical context
- Ask for specific examples or explanations
- Be clear about expected output format
- Maintain the original intent

Return only the enhanced prompt, nothing else.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: enhancementPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error("Failed to enhance prompt")
    }

    const data = await response.json()
    return data.response?.trim() || request.prompt
  } catch (error) {
    clearTimeout(timeoutId)
    console.error("Prompt enhancement error:", error)
    return request.prompt // Return original if enhancement fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Handle prompt enhancement
    if (body.action === "enhance") {
      const enhancedPrompt = await enhancePrompt(body as EnhancePromptRequest)
      return NextResponse.json({ enhancedPrompt })
    }

    // Handle regular chat
    const { message, history } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required and must be a string" }, { status: 400 })
    }

    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg: any) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role),
        )
      : []

    const recentHistory = validHistory.slice(-10)
    const messages: ChatMessage[] = [...recentHistory, { role: "user", content: message }]

    const aiResponse = await generateAIResponse(messages)

    if (!aiResponse || !aiResponse.content) {
      throw new Error("Empty response from AI model")
    }

    return NextResponse.json({
      response: aiResponse.content,
      model: aiResponse.model,
      tokens: aiResponse.tokens,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in AI chat route:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "AI Chat API is running",
    timestamp: new Date().toISOString(),
    model: OLLAMA_MODEL,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    info: "Use POST method to send chat messages or enhance prompts",
  })
}