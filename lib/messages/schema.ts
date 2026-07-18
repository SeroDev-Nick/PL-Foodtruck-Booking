import { z } from "zod";
import { MESSAGE_SUBJECTS } from "@/lib/messages/subjects";

export const MESSAGE_BODY_MAX_LENGTH = 4000;

export const messageSubmissionSchema = z
  .object({
    truckId: z.string().uuid("Select your truck."),
    subject: z.enum(MESSAGE_SUBJECTS),
    body: z
      .string()
      .trim()
      .min(1, "Enter a message.")
      .max(MESSAGE_BODY_MAX_LENGTH, "Message is too long."),
  })
  .strict();

export type MessageSubmission = z.infer<typeof messageSubmissionSchema>;
