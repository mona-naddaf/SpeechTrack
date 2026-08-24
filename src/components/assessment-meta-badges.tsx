import {
  ASSESSMENT_FORMALITY_LABELS,
  ASSESSMENT_KIND_LABELS,
} from "@/lib/assessment";
import type { Area, AssessmentFormality, AssessmentKind } from "@/lib/types";

type Props = {
  kind: AssessmentKind | null;
  formality: AssessmentFormality | null;
  areas: Area[];
};

const SET_BADGE = "rounded-full px-2.5 py-1 text-xs font-medium";
const UNSET_BADGE = `${SET_BADGE} bg-stone-100 text-stone-600`;

/** Small badge row for an assessment's kind/formality/areas — used on the
 *  toolkit list and the student-page "Run assessment" picker so she can
 *  scan for the right one quickly. */
export default function AssessmentMetaBadges({ kind, formality, areas }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={kind ? `${SET_BADGE} bg-brand-100 text-brand-800` : UNSET_BADGE}>
        {kind ? ASSESSMENT_KIND_LABELS[kind] : "Kind not set"}
      </span>
      <span
        className={
          formality ? `${SET_BADGE} bg-accent-100 text-accent-800` : UNSET_BADGE
        }
      >
        {formality ? ASSESSMENT_FORMALITY_LABELS[formality] : "Formality not set"}
      </span>
      {areas.map((area) => (
        <span key={area.id} className={`${SET_BADGE} bg-stone-100 text-stone-600`}>
          {area.name}
        </span>
      ))}
    </div>
  );
}
