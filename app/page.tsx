import { connection } from "next/server";
import { PatchrunApp } from "@/components/PatchrunApp";
import { activeProvider } from "@/lib/ai/provider";

export default async function Home() {
  // Render per request so AI availability reflects the deployment's current env vars.
  await connection();
  // Only a boolean and the model name reach the client; the key never does.
  const ai = activeProvider();
  return <PatchrunApp aiStatus={{ configured: ai.configured, model: ai.model }} />;
}
