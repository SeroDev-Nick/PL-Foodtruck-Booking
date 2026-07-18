"use client";

import { useEffect, useRef } from "react";
import { markTruckMessagesRead } from "@/app/dashboard/trucks/[truckId]/messages/actions";

type MarkTruckMessagesReadOnMountProps = {
  truckId: string;
};

/**
 * Runs mark-as-read as a real Server Action after mount.
 * Calling revalidatePath during a Server Component render is unsupported;
 * invoking the action from the client avoids that.
 */
export function MarkTruckMessagesReadOnMount({
  truckId,
}: MarkTruckMessagesReadOnMountProps) {
  const ranForTruckRef = useRef<string | null>(null);

  useEffect(() => {
    if (!truckId || ranForTruckRef.current === truckId) {
      return;
    }
    ranForTruckRef.current = truckId;

    void markTruckMessagesRead(truckId);
  }, [truckId]);

  return null;
}
