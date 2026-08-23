import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { HomePracticeItem, PracticeLogWithPraise } from "@/lib/types";
import LogPracticeForm from "./log-practice-form";
import LogoutButton from "./logout-button";

type Props = {
  studentName: string;
  items: HomePracticeItem[];
  logs: PracticeLogWithPraise[];
  itemsError: string | null;
  logsError: string | null;
};

export default function ParentDashboard({
  studentName,
  items,
  logs,
  itemsError,
  logsError,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Hi! Here&apos;s {studentName}&apos;s home practice.
        </h1>
        <LogoutButton />
      </div>

      {itemsError && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load practice items: {itemsError}
        </p>
      )}

      {items.length === 0 && !itemsError && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          Your child&apos;s therapist hasn&apos;t added any practice items
          yet.
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            What to practice
          </h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="font-medium text-slate-900">
                  {item.what_to_practice}
                </p>
                {item.how_to_practice && (
                  <p className="mt-1 text-sm text-slate-600">
                    {item.how_to_practice}
                  </p>
                )}
                {item.last_worked_date && (
                  <p className="mt-2 text-xs text-slate-400">
                    Last worked on {formatDate(item.last_worked_date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Log today&apos;s practice
        </h2>
        <div className="mt-3">
          <LogPracticeForm items={items} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Practice history
        </h2>

        {logsError && (
          <p className="mt-3 text-sm text-red-600">
            Couldn&apos;t load practice history: {logsError}
          </p>
        )}

        {logs.length === 0 && !logsError && (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            No practice logged yet.
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-3 space-y-3">
            {logs.map((log) => {
              const mood = getHowItWentOption(log.how_it_went);
              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {formatDate(log.date)}
                    </p>
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <span className="text-base">{mood.emoji}</span>
                      {mood.label}
                    </span>
                  </div>

                  {log.activities.length > 0 && (
                    <p className="mt-2 text-sm text-slate-600">
                      {log.activities.map((a) => a.text).join(", ")}
                    </p>
                  )}

                  {log.note && (
                    <p className="mt-2 text-sm text-slate-600">{log.note}</p>
                  )}

                  {log.praise.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {log.praise.map((p) => (
                        <p
                          key={p.id}
                          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                        >
                          🌟 {p.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
