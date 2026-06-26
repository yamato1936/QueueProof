import { NextResponse } from "next/server";
import { getQueueStore } from "@/lib/queueproof/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const capacity = Number(body.capacity);
    if (!body.title || !body.sku || !Number.isInteger(capacity) || capacity < 1) {
      return NextResponse.json({ error: "title, sku and positive integer capacity are required." }, { status: 400 });
    }
    const drop = await getQueueStore().createDrop({
      merchantId: body.merchantId || "merchant_demo",
      title: body.title,
      sku: body.sku,
      capacity,
      shardCount: Number(body.shardCount || 10)
    });
    return NextResponse.json(drop, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
