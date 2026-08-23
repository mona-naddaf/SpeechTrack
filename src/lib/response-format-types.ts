import type { ResponseFormatType } from "./types";

/**
 * Every response format type the app knows about. Only "cueing_hierarchy"
 * has a real editor today — the rest are shown as placeholders on the
 * formats page until they're built out.
 */
export const RESPONSE_FORMAT_TYPE_LABELS: {
  type: ResponseFormatType;
  label: string;
  description: string;
}[] = [
  {
    type: "cueing_hierarchy",
    label: "Cueing hierarchy",
    description: "Track the level of support a student needed to respond.",
  },
  {
    type: "correct_incorrect",
    label: "Correct/Incorrect",
    description: "Simple right or wrong scoring.",
  },
  {
    type: "rating_scale",
    label: "Rating scale",
    description: "Score responses on a numeric scale.",
  },
  {
    type: "pronunciation",
    label: "Pronunciation/transcription",
    description: "Record phonetic transcriptions of responses.",
  },
  {
    type: "open_text",
    label: "Open text",
    description: "Free-form notes for each response.",
  },
  {
    type: "behaviour_description",
    label: "Behaviour description",
    description: "Describe observed behaviour in detail.",
  },
  {
    type: "frequency_tally",
    label: "Frequency tally",
    description: "Count occurrences during a session.",
  },
];
