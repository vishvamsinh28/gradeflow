import Link from "next/link";
import { Header } from "@/components/Header";

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const subtlePanelClass = "rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4";

const workflowSteps = [
  ["1", "Create a class", "Add the class name, subject, and optional grade level."],
  ["2", "Add students", "Use Add student on the class page so uploads and result links can be tied to real students."],
  ["3", "Create an assignment", "Add the question, expected answer, points, and the grading rules AI should follow."],
  ["4", "Upload student work", "Upload images or PDFs, optionally attached to a roster student."],
  ["5", "Grade submissions", "Use the bulk grade button or a row-level Grade button to run AI on student work."],
  ["6", "Review and publish", "Check flagged work, then publish results so students can open their secure links."],
];

const features = [
  {
    title: "Dashboard",
    use: "See all classes, total assignments, and any submissions that need review.",
    example: "If Algebra has 3 flagged submissions, they appear in the review preview so you can jump straight into teacher review.",
  },
  {
    title: "Classes and roster",
    use: "Keep assignments and students grouped by class. The class page is where you create assignments, add students, copy result links, and inspect student history.",
    example: "Create Grade 7 Algebra, add students like Anika Patel and Marcus Tan, then reuse the roster when uploading work.",
  },
  {
    title: "Assignment setup",
    use: "Tell AI what the worksheet asks, what the expected answer is, and how points should be awarded.",
    example: "For a 5-point linear equation question, include the prompt, the correct solution steps, and rules like 'award method marks for a correct approach.'",
  },
  {
    title: "Batch uploads",
    use: "Upload one or many PDFs/images for grading. Single uploads can be attached to an existing student or create a new student while uploading.",
    example: "Upload Marcus Tan's worksheet, pick Marcus from the student dropdown, then click Upload submission. For a batch, upload all files first and review names later.",
  },
  {
    title: "AI grading",
    use: "Runs extraction and grading against your answer key and rubric. Use Grade on one row, or Grade all eligible uploads from the assignment header.",
    example: "AI reads the submitted work, gives question scores, writes feedback, and records a confidence score.",
  },
  {
    title: "Review queue",
    use: "Collects low-confidence submissions from every class.",
    example: "If confidence is below the review threshold, the submission waits for teacher judgment before publishing.",
  },
  {
    title: "Teacher review",
    use: "Choose whether to keep the AI score or override it.",
    example: "If AI gave 8/10 but you decide the student deserves 10/10, use Save changes. If AI's 8/10 is correct, use Approve AI score.",
  },
  {
    title: "Publish to students",
    use: "Releases completed grades to each student's secure results link.",
    example: "Before publishing, students see nothing for that assignment. After publishing, their portal shows score and feedback.",
  },
  {
    title: "Student result links",
    use: "Each roster student has a Link button. It copies a private results URL for that student.",
    example: "Send Marcus his copied link. He only sees assignments that have been published to students.",
  },
  {
    title: "Settings",
    use: "Set the Gemini model, confidence threshold, default subject, grade, and grading rules.",
    example: "A 0.72 threshold means work below 72 percent confidence goes to review.",
  },
  {
    title: "Regrade and history",
    use: "After changing an answer key or rubric, regrade existing submissions and keep a version/audit trail.",
    example: "If you add a partial-credit rule later, save the assignment version and queue regrade all.",
  },
];

const classControls = [
  ["Create class", "Dashboard", "Creates the container for one group of students, assignments, submissions, and analytics."],
  ["Add student", "Class page", "Adds a student to the roster. Once added, their name appears in upload dropdowns and student history."],
  ["Student name", "Class roster", "Opens the student page with all submissions, average score, completed count, and review count."],
  ["Link", "Class roster", "Copies that student's result portal URL. The link is useful only after an assignment is published."],
  ["Delete student", "Class roster", "Removes the roster student. Use carefully because this is a destructive action."],
];

const assignmentControls = [
  ["Create assignment", "Class page", "Builds the answer key AI will use: title, total points, instructions, general rules, questions, solutions, rubric, and common mistakes."],
  ["Upload submission", "Assignment page", "Adds one or more student files. Choose an existing student, create a new student by name, or leave the file unassigned."],
  ["Grade X", "Assignment header", "Grades every eligible uploaded or failed submission using the current assignment key. The number shows how many are ready to run."],
  ["Grade", "Submission row", "Grades or retries one specific submission. Use this when only one file failed or was added later."],
  ["Filters", "Submission list", "Switch between all, uploaded, processing, needs review, completed, and failed so a long assignment stays manageable."],
  ["Publish to students", "Assignment header", "Makes completed results visible in student portals. It is blocked while review-required submissions still need teacher action."],
  ["Export CSV", "Assignment page", "Downloads a spreadsheet-style summary of student, status, score, confidence, and review state."],
];

const reviewControls = [
  ["Save changes", "Teacher review page", "Keeps your edited score or feedback. Use this when you disagree with AI."],
  ["Approve AI score", "Teacher review page", "Restores and accepts the original AI score from the question-level grading result."],
  ["Open queue", "Dashboard or review page", "Shows low-confidence submissions across classes so you can clear review work before publishing."],
  ["Delete submission", "Assignment or review page", "Removes the uploaded file and its grading result. Use only when the upload is wrong or duplicated."],
];

const scoreRows = [
  ["Q1", "Correct setup and final answer", "5 / 5", "96%", "Ready"],
  ["Q2", "Right method, arithmetic slip", "3 / 5", "88%", "Partial credit"],
  ["Q3", "Unreadable final step", "0 / 5", "61%", "Needs review"],
];

export default function GuidePage() {
  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <section className="border-b border-[#8496b01f] pb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Product guide</div>
          <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">How to use GradeFlow</h1>
          <p className="mt-3 max-w-3xl text-[#8496B0]">
            A practical guide to every major feature: what it does, when to use it, and what AI output should look like.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="app-btn app-btn-primary" href="#workflow">Start with workflow</a>
            <a className="app-btn app-btn-ghost" href="#controls">Button guide</a>
            <a className="app-btn app-btn-ghost" href="#example">See grading example</a>
            <Link className="app-btn app-btn-secondary" href="/dashboard">Go to dashboard</Link>
          </div>
        </section>

        <section id="workflow" className={`${panelClass} mt-6`}>
          <div className="mb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Recommended path</div>
            <h2 className="font-display text-2xl font-semibold">The simple teacher flow</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map(([number, title, text]) => (
              <article className={subtlePanelClass} key={number}>
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg border border-[#00c9a733] bg-[#00c9a714] font-mono text-sm text-[#00C9A7]">{number}</div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#8496B0]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="controls" className="mt-6 grid gap-6 xl:grid-cols-3">
          <ControlGroup title="Class and student controls" rows={classControls} />
          <ControlGroup title="Assignment and grading controls" rows={assignmentControls} />
          <ControlGroup title="Review and result controls" rows={reviewControls} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={panelClass}>
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Roster example</div>
              <h2 className="font-display text-2xl font-semibold">Creating students and links</h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-[#8496B0]">
              <p>
                On a class page, type a student name in Add student and click Add student. The student immediately appears in the roster.
              </p>
              <p>
                Click the student's name to see their submission history. Click Link to copy their private results page, such as /results/student-token.
              </p>
              <p>
                That link does not expose draft work. It only shows assignments after you click Publish to students.
              </p>
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Grading example</div>
              <h2 className="font-display text-2xl font-semibold">Which grade button to use</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ExampleBlock label="Bulk grading" value="Use Grade 12 when you uploaded 12 files and want AI to process every ungraded or failed submission in the assignment." />
              <ExampleBlock label="Single grading" value="Use the Grade button on one submission row when one student's file was added later or a previous grading run failed." />
              <ExampleBlock label="After grading" value="Completed submissions can be published. Low-confidence submissions move to teacher review before publishing." />
              <ExampleBlock label="After publishing" value="Students open their copied result link and see the returned score, feedback, and question-level details." />
            </div>
          </div>
        </section>

        <section id="example" className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className={panelClass}>
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Assignment example</div>
              <h2 className="font-display text-2xl font-semibold">Input you give AI</h2>
            </div>
            <div className="space-y-3">
              <ExampleBlock label="Title" value="Linear equations quiz" />
              <ExampleBlock label="Question prompt" value="Solve 2x + 3 = 11. Show your steps." />
              <ExampleBlock label="Expected answer" value="Subtract 3 from both sides to get 2x = 8, then divide by 2. x = 4." />
              <ExampleBlock label="Rubric" value="2 points for subtracting 3 correctly. 2 points for dividing by 2 correctly. 1 point for final answer x = 4." />
              <ExampleBlock label="Common mistakes" value="Subtracting from one side only. Dividing 11 by 2 before isolating x. Final answer without work." />
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">AI output</div>
              <h2 className="font-display text-2xl font-semibold">What grading looks like</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[#8496B0]">
                  <tr>
                    <th className="px-3 py-2">Question</th>
                    <th className="px-3 py-2">AI reasoning</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Teacher action</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreRows.map(([question, reasoning, score, confidence, action]) => (
                    <tr className="bg-[#0B1829]" key={question}>
                      <td className="rounded-l-xl px-3 py-3 font-display font-semibold text-[#E2EAF4]">{question}</td>
                      <td className="px-3 py-3 text-[#8496B0]">{reasoning}</td>
                      <td className="px-3 py-3 font-mono text-[#F8FAFC]">{score}</td>
                      <td className="px-3 py-3 font-mono text-[#00C9A7]">{confidence}</td>
                      <td className="rounded-r-xl px-3 py-3 text-[#E2EAF4]">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 rounded-xl border border-[#f59e0b33] bg-[#f59e0b0d] p-4 text-sm leading-6 text-[#FCD68A]">
              If you edit a score, click Save changes. If AI is correct, click Approve AI score. Published results only appear to students after you click Publish to students on the assignment page.
            </div>
          </div>
        </section>

        <section className={`${panelClass} mt-6`}>
          <div className="mb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Feature reference</div>
            <h2 className="font-display text-2xl font-semibold">What every feature is for</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {features.map((feature) => (
              <article className={subtlePanelClass} key={feature.title}>
                <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#E2EAF4]">{feature.use}</p>
                <p className="mt-3 border-t border-[#8496b01a] pt-3 text-sm leading-6 text-[#8496B0]">{feature.example}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <GuideCallout title="When to trust AI" text="Trust AI when confidence is high and the rubric matches the assignment. Review anything low-confidence, unreadable, or surprisingly scored." />
          <GuideCallout title="When to edit" text="Edit the score when the student deserves a different final score. Edit the assignment rubric when many students are affected by the same rule." />
          <GuideCallout title="When to publish" text="Publish only after required reviews are clear. Students cannot see unpublished assignments in their result link." />
        </section>
      </main>
    </div>
  );
}

function ExampleBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className={subtlePanelClass}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">{label}</div>
      <p className="text-sm leading-6 text-[#E2EAF4]">{value}</p>
    </div>
  );
}

function GuideCallout({ title, text }: { title: string; text: string }) {
  return (
    <article className={panelClass}>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#8496B0]">{text}</p>
    </article>
  );
}

function ControlGroup({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <article className={panelClass}>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map(([control, place, explanation]) => (
          <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={`${title}-${control}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold text-[#E2EAF4]">{control}</span>
              <span className="rounded-full border border-[#00c9a733] bg-[#00c9a714] px-2 py-0.5 text-[11px] font-semibold text-[#00C9A7]">{place}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#8496B0]">{explanation}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
