import type { ResponseFormatType } from "./types";

/**
 * Every response format type the app knows about. "cueing_hierarchy",
 * "correct_incorrect", "rating_scale", "sentence_structure", and
 * "language_sample" are
 * creatable with a real editor (see CREATABLE_TYPES in formats-list.tsx)
 * — the rest are shown as placeholders on the formats page until they're
 * built out.
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
    type: "sentence_structure",
    label: "Sentence structure",
    description:
      "Track each part of a multi-part utterance (e.g. Subject + is/are + Verb + -ing + Object) separately in one trial.",
  },
  {
    type: "language_sample",
    label: "Language sample",
    description:
      "Collect the child's actual utterances — what they said, what it meant, whether it fit the context, and the support level it came with.",
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
