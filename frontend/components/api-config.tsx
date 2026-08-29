import { apiUrlScript } from "@/lib/runtime-config";

/**
 * Hands the API base URL to the browser at request time.
 *
 * Only rendered by the routes that actually call the API. The landing page does
 * not, so it stays static and CDN-cacheable — forcing the whole app dynamic to
 * carry one string was too blunt.
 */
export function ApiConfig() {
  return <script dangerouslySetInnerHTML={{ __html: apiUrlScript() }} />;
}
