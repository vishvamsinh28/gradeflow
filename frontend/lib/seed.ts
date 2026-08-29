import type {
  AttendanceMap,
  Classroom,
  Database,
  QuestionMark,
  Student,
  Submission,
  Subject,
  Test,
} from "./types";

/* ---------- Deterministic randomness ----------
   The sample workspace must render identically on the server and the client,
   so every "random" value comes from a seeded generator, never Math.random. */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

/* ---------- Dates ---------- */

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/* ---------- Name pools ---------- */

const FIRST = [
  "Rahul", "Priya", "Aarav", "Riya", "Ananya", "Vivaan", "Diya", "Arjun",
  "Ishaan", "Meera", "Kabir", "Saanvi", "Aditya", "Nisha", "Rohan", "Tara",
  "Krishna", "Aisha", "Dev", "Kavya", "Yash", "Sneha", "Manav", "Pooja",
  "Neel", "Anjali", "Siddharth", "Trisha", "Omkar", "Lavanya", "Harsh", "Ira",
  "Farhan", "Zoya", "Nikhil", "Rhea", "Advait", "Mitali", "Karan", "Simran",
];

const LAST = [
  "Sharma", "Patel", "Shah", "Iyer", "Reddy", "Nair", "Desai", "Mehta",
  "Rao", "Kulkarni", "Banerjee", "Gupta", "Kapoor", "Joshi", "Menon", "Chauhan",
  "Bose", "Pillai", "Sethi", "Ahuja",
];

function makeStudents(seed: string, count: number): Student[] {
  const next = rng(`students:${seed}`);
  const used = new Set<string>();
  const students: Student[] = [];
  let attempts = 0;

  while (students.length < count && attempts < count * 40) {
    attempts += 1;
    const name = `${pick(next, FIRST)} ${pick(next, LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    students.push({ id: "", code: "", name });
  }

  return students
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((student, index) => ({
      ...student,
      id: `${seed}-s${index + 1}`,
      code: `STU-${String(index + 1).padStart(3, "0")}`,
      rollNo: String(index + 1),
    }));
}

/* ---------- Grading simulation for seeded results ---------- */

/** A stable per-student ability so results look coherent across subjects. */
function ability(studentId: string): number {
  return 0.5 + rng(`ability:${studentId}`)() * 0.45;
}

const NOTES_GOOD = [
  "Correct method and a clean final answer.",
  "Well structured, units carried through correctly.",
  "Right approach, working clearly laid out.",
  "Accurate throughout.",
];

const NOTES_PARTIAL = [
  "Correct method, arithmetic slip in the final step.",
  "Right idea but the units were dropped.",
  "Partial credit — second condition not checked.",
  "Set up correctly, simplification incomplete.",
];

const NOTES_POOR = [
  "Method not applicable to this question.",
  "Answer left incomplete.",
  "Concept confused with the previous chapter.",
  "No supporting working shown.",
];

function gradeFor(testId: string, student: Student, maxMarks: number) {
  const next = rng(`grade:${testId}:${student.id}`);
  const base = ability(student.id) + (next() - 0.5) * 0.16;
  const ratio = Math.max(0.24, Math.min(0.99, base));

  const questionCount = 4 + Math.floor(next() * 2);
  const per = maxMarks / questionCount;
  const questions: QuestionMark[] = [];
  let total = 0;

  for (let i = 0; i < questionCount; i += 1) {
    const wobble = (next() - 0.5) * 0.34;
    const qRatio = Math.max(0, Math.min(1, ratio + wobble));
    const awarded = Math.round(per * qRatio * 2) / 2;
    total += awarded;
    const notes = qRatio > 0.85 ? NOTES_GOOD : qRatio > 0.45 ? NOTES_PARTIAL : NOTES_POOR;
    questions.push({
      number: `Q${i + 1}`,
      awarded,
      outOf: Math.round(per * 2) / 2,
      note: pick(next, notes),
    });
  }

  const percent = total / maxMarks;
  const summary =
    percent > 0.85
      ? "Consistently accurate. Method marks awarded in full."
      : percent > 0.6
        ? "Solid understanding; loses marks on the final steps rather than the approach."
        : percent > 0.4
          ? "Grasps the setup but the working breaks down midway. Worth a second look together."
          : "Struggling with the core method for this chapter.";

  return {
    score: Math.round(total * 2) / 2,
    questions,
    summary,
    needsReview: next() < 0.07,
  };
}

/* ---------- Classroom builders ---------- */

type TestSpec = {
  key: string;
  title: string;
  subject: string;
  daysAgo: number;
  maxMarks: number;
  status: Test["status"];
  instructions?: string;
  /** For "collecting" tests: fraction of the roster that has uploaded so far. */
  submittedRatio?: number;
  /** For "grading" tests: fraction already graded. */
  gradedRatio?: number;
};

function buildClassroom(
  id: string,
  slug: string,
  name: string,
  description: string,
  subjectNames: string[],
  studentCount: number,
  testSpecs: TestSpec[],
): { classroom: Classroom; submissions: Submission[]; attendance: AttendanceMap } {
  const subjects: Subject[] = subjectNames.map((subjectName, index) => ({
    id: `${id}-sub${index + 1}`,
    name: subjectName,
  }));

  const students = makeStudents(id, studentCount);

  const tests: Test[] = testSpecs.map((spec) => ({
    id: `${id}-t-${spec.key}`,
    date: daysAgo(spec.daysAgo),
    title: spec.title,
    subjectId: subjects.find((subject) => subject.name === spec.subject)?.id,
    instructions: spec.instructions,
    maxMarks: spec.maxMarks,
    status: spec.status,
    createdAt: daysAgo(spec.daysAgo + 1),
  }));

  const submissions: Submission[] = [];
  const attendance: AttendanceMap = {};

  tests.forEach((test, testIndex) => {
    const spec = testSpecs[testIndex];
    const next = rng(`roster:${test.id}`);

    students.forEach((student, studentIndex) => {
      const absent = next() < 0.045;
      if (absent) {
        attendance[`${test.id}:${student.id}`] = "absent";
        return;
      }

      const position = studentIndex / students.length;
      if (spec.status === "collecting") {
        if (position >= (spec.submittedRatio ?? 0)) return;
        submissions.push({
          id: `${test.id}-${student.id}`,
          testId: test.id,
          studentId: student.id,
          fileName: `${student.code.toLowerCase()}-answer.pdf`,
          status: "awaiting",
        });
        return;
      }

      const result = gradeFor(test.id, student, test.maxMarks);
      const stillGrading = spec.status === "grading" && position >= (spec.gradedRatio ?? 1);

      submissions.push({
        id: `${test.id}-${student.id}`,
        testId: test.id,
        studentId: student.id,
        fileName: `${student.code.toLowerCase()}-answer.pdf`,
        matchedByAI: true,
        status: stillGrading ? "queued" : "graded",
        ...(stillGrading
          ? {}
          : {
              score: result.score,
              outOf: test.maxMarks,
              summary: result.summary,
              questions: result.questions,
              needsReview: result.needsReview,
              gradedAt: test.date,
            }),
      });
    });
  });

  return {
    classroom: {
      id,
      slug,
      name,
      description,
      subjects,
      students,
      tests,
      createdAt: daysAgo(120),
    },
    submissions,
    attendance,
  };
}

export function createSeedDatabase(): Database {
  const classA = buildClassroom(
    "c10a",
    "class-10-a",
    "Class 10-A",
    "Board year section. Weekly unit tests, monthly revision papers.",
    ["Mathematics", "Physics", "Chemistry", "English"],
    32,
    [
      {
        key: "math-mid",
        title: "Algebra Midterm",
        subject: "Mathematics",
        daysAgo: 17,
        maxMarks: 40,
        status: "graded",
        instructions:
          "Give method marks when the approach is correct but the arithmetic slips. Do not penalise the same error twice.",
      },
      {
        key: "phy-u3",
        title: "Unit Test 3 — Laws of Motion",
        subject: "Physics",
        daysAgo: 10,
        maxMarks: 25,
        status: "graded",
        instructions: "Be strict about units and significant figures.",
      },
      {
        key: "chem-pt",
        title: "Periodic Table Quiz",
        subject: "Chemistry",
        daysAgo: 4,
        maxMarks: 20,
        status: "graded",
      },
      {
        key: "eng-comp",
        title: "Comprehension & Writing",
        subject: "English",
        daysAgo: 1,
        maxMarks: 30,
        status: "collecting",
        submittedRatio: 0.55,
        instructions:
          "Reward structure and argument over spelling. Flag anything that reads as copied.",
      },
    ],
  );

  const classB = buildClassroom(
    "c9b",
    "class-9-b",
    "Class 9-B",
    "Mixed-ability section, three periods a week.",
    ["Mathematics", "Science", "English", "History"],
    28,
    [
      {
        key: "math-mens",
        title: "Mensuration Test",
        subject: "Mathematics",
        daysAgo: 12,
        maxMarks: 30,
        status: "graded",
        instructions: "Accept answers in terms of π or as decimals.",
      },
      {
        key: "sci-ch5",
        title: "Chapter 5 Assessment",
        subject: "Science",
        daysAgo: 3,
        maxMarks: 25,
        status: "collecting",
        submittedRatio: 0.2,
      },
    ],
  );

  const classC = buildClassroom(
    "c12s",
    "class-12-science",
    "Class 12-Science",
    "Pre-board preparation batch.",
    ["Physics", "Chemistry", "Mathematics"],
    18,
    [
      {
        key: "phy-elec",
        title: "Electrostatics Test",
        subject: "Physics",
        daysAgo: 8,
        maxMarks: 35,
        status: "graded",
      },
      {
        key: "chem-org",
        title: "Organic Chemistry Quiz",
        subject: "Chemistry",
        daysAgo: 2,
        maxMarks: 20,
        status: "grading",
        gradedRatio: 0.6,
        instructions: "Accept either IUPAC or common names for the named reactions.",
      },
    ],
  );

  return {
    version: 2,
    teacherName: "Meera",
    classrooms: [classA.classroom, classB.classroom, classC.classroom],
    submissions: [...classA.submissions, ...classB.submissions, ...classC.submissions],
    attendance: { ...classA.attendance, ...classB.attendance, ...classC.attendance },
  };
}

export { gradeFor as simulateGrade, rng as seededRng };
