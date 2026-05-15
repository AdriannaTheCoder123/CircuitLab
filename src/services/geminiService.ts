import { GoogleGenAI } from "@google/genai";
import { CircuitComponent, SimulationResult } from "./types";

export async function analyzeCircuit(components: CircuitComponent[], result: SimulationResult | null) {
  if (!components.length) return "Add some components to the circuit first!";
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const circuitState = {
    components: components.map(c => ({
      type: c.type,
      value: c.value,
      state: c.state,
      label: c.label
    })),
    simulation: result ? {
        totalCurrent: result.components.reduce((acc, c) => acc + c.current, 0),
        components: result.components.map(r => {
            const comp = components.find(c => c.id === r.id);
            return {
                type: comp?.type,
                current: r.current,
                voltageDrop: r.voltageDrop,
                power: r.power
            };
        })
    } : "Not currently simulating"
  };

  const prompt = `You are a helpful Physics Lab Assistant for a student named Adrianna.
  Analyze the following circuit state and provide a short, encouraging summary (2-3 sentences).
  If there is no current flow, explain why (e.g., missing battery, open switch, or incomplete loop).
  If there is current, explain what's happening (e.g., "The bulb is glowing because 1.5A are flowing through it").
  
  Circuit State: ${JSON.stringify(circuitState)}
  
  Keep it clear and scientific but friendly!`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI assistant is taking a break. Check your connections!";
  }
}
