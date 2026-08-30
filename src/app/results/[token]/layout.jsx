/**
 * Server layout so the API URL is read from the environment on the server, not
 * from a client component where `process.env` does not exist.
 */
export const dynamic = "force-dynamic";
export default function ResultsLayout({ children }) {
  return <>{children}</>;
}
