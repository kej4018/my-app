import { requireUser } from "../lib/auth/guard";
import { coordinate, elapsedLabel, isOverdue } from "../lib/interview";
import { buildSlotOptions } from "../lib/schedule";
import { getPosition, listInterviews, positions } from "../lib/store";
import InterviewClient, { type InterviewView } from "./interview-client";

// 메모리 저장소의 최신 조율 현황을 매 요청마다 불러온다
export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  await requireUser("/interview");

  const requests: InterviewView[] = listInterviews()
    .reverse()
    .map((request) => ({
      id: request.id,
      applicantName: request.applicantName,
      positionTitle: getPosition(request.positionId)?.title ?? "",
      status: request.status,
      applicantSlots: request.applicantSlots,
      managerSlots: request.managerSlots,
      suggestions: coordinate(request.applicantSlots, request.managerSlots).suggestions,
      confirmedSlot: request.confirmedSlot,
      note: request.note,
      elapsed: elapsedLabel(request),
      overdue: isOverdue(request),
    }));

  return (
    <InterviewClient
      positions={positions}
      slotOptions={buildSlotOptions()}
      initialRequests={requests}
    />
  );
}
