import { connection } from "next/server";
import { PatchrunApp } from "@/components/PatchrunApp";
import { AI_MODEL, aiConfigured } from "@/lib/ai/anthropic";

export default async function Home() {
  // Render per request so AI availability reflects the deployment's current env vars.
  await connection();
  // Only a boolean and the model name reach the client; the key never does.
  return <PatchrunApp aiStatus={{ configured: aiConfigured(), model: AI_MODEL }} />;
}
