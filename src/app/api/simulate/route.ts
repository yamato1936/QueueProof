import { NextResponse } from "next/server";
import { runSimulation } from "@/lib/queueproof/simulate";
import { getDynamoRuntimeInfo } from "@/lib/queueproof/store";

export async function POST() {
  try {
    const result = await runSimulation();
    const runtime = getDynamoRuntimeInfo();
    console.log("[QueueProof simulation]", {
      realDynamoDBMode: runtime.realDynamoDBMode,
      tableName: runtime.tableName,
      region: runtime.region,
      numberOfItemsWritten: result.totalDynamoDBItemsWritten
    });
    return NextResponse.json(result);
  } catch (error) {
    const runtime = getDynamoRuntimeInfo();
    console.error("[QueueProof simulation failed]", {
      realDynamoDBMode: runtime.realDynamoDBMode,
      tableName: runtime.tableName,
      region: runtime.region,
      error
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "Error"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
