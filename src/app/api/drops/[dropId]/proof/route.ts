import { NextResponse } from "next/server";
import { getQueueStore } from "@/lib/queueproof/store";

export async function GET(_request: Request, { params }: { params: { dropId: string } }) {
  try {
    const proof = await getQueueStore().generateProof(params.dropId);
    return NextResponse.json(proof);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
