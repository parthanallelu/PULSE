const GEMINI_API_KEY = "AIzaSyC0E_I30C0KoiSTsu8s3T0KVuK0t0oTqMo";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function analyzeIncident(description, base64Image = null) {
  const prompt = `You are an AI crisis response coordinator. Analyze the following citizen emergency report and return a strictly structured JSON response.

Incident Report: "${description}"

Generate a JSON output following this schema EXACTLY:
{
  "incidentType": "fire" | "flood" | "collapse" | "medical" | "conflict" | "other",
  "severity": "Low" | "Medium" | "High",
  "urgencyScore": number (1 to 10),
  "summary": "Concise summary prioritizing required dispatch actions."
}

Do not return any conversational text or markdown wrappers. Output valid JSON.`;

  const contents = [];
  const parts = [{ text: prompt }];

  if (base64Image) {
    // Extract actual base64 payload from data URL
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (mimeMatch) {
      parts.push({
        inlineData: {
          mimeType: mimeMatch[1],
          data: mimeMatch[2]
        }
      });
    }
  }

  contents.push({ parts });

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResult) {
      throw new Error("Empty response from Gemini API");
    }

    // Attempt to parse response
    const parsed = JSON.parse(textResult.trim());
    return {
      incidentType: parsed.incidentType || 'other',
      severity: ['Low', 'Medium', 'High'].includes(parsed.severity) ? parsed.severity : 'Medium',
      urgencyScore: Number.isInteger(parsed.urgencyScore) ? Math.min(10, Math.max(1, parsed.urgencyScore)) : 5,
      summary: parsed.summary || 'Incident processing completed.'
    };
  } catch (error) {
    console.error("Gemini analysis failure:", error);
    // Fallback heuristic if API fails or network goes dark
    return {
      incidentType: 'other',
      severity: 'Medium',
      urgencyScore: 5,
      summary: `[Fallback Mode] ${description.slice(0, 50)}...`
    };
  }
}
