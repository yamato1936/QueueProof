import { NextResponse } from "next/server";
import { getQueueStore } from "@/lib/queueproof/store";

export async function POST(request: Request, { params }: { params: { dropId: string } }) {
  try {
    const body = await request.json();
    if (!body.userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }
    const result = await getQueueStore().reserve(params.dropId, body.userId, body.requestId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
