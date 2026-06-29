"use client";

import { FormEvent, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useToast } from "@/components/ToastProvider";
import { api } from "@/lib/api";
import { AuditLog, TeacherSettings } from "@/lib/types";

const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";
const inputClass = "app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm text-[#F8FAFC]";
const textareaClass = "app-textarea min-h-[140px] w-full resize-y rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-sm leading-6 text-[#E2EAF4]";

export default function SettingsPage() {
  const { notify } = useToast();
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [settingsRow, auditRows] = await Promise.all([
        api<TeacherSettings>("/settings"),
        api<AuditLog[]>("/settings/audit-logs"),
      ]);
      setSettings(settingsRow);
      setLogs(auditRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load settings";
      setError(message);
      notify(message, "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      await api<TeacherSettings>("/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      notify("Settings saved", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save settings";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-background min-h-screen">
      <Header />
      <main className="mx-auto w-[min(1180px,92vw)] pb-20 pt-10 sm:pt-12">
        <div className="border-b border-[#8496b01f] pb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9A7]">Workspace controls</div>
          <h1 className="font-display text-4xl font-bold tracking-[-1.5px] sm:text-5xl">Teacher settings</h1>
          <p className="mt-3 max-w-2xl text-[#8496B0]">Set grading model behavior, review sensitivity, and defaults used when creating new classes and assignments.</p>
        </div>

        {error && <div className="mt-6 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_420px]">
          <form className={panelClass} onSubmit={save}>
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold">Grading configuration</h2>
              <p className="mt-1 text-sm text-[#8496B0]">These values are used by future grading runs and new class setup.</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Gemini model</span>
              <input className={inputClass} value={settings?.gemini_model ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, gemini_model: event.target.value } : current)} required />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Review threshold</span>
              <input className={inputClass} min="0" max="1" step="0.01" type="number" value={settings?.confidence_threshold ?? 0.72} onChange={(event) => setSettings((current) => current ? { ...current, confidence_threshold: Number(event.target.value) } : current)} required />
              <p className="mt-2 text-xs leading-5 text-[#8496B0]">Grades below this confidence are routed to review.</p>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Default subject</span>
                <input className={inputClass} value={settings?.default_subject ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, default_subject: event.target.value } : current)} required />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Default grade</span>
                <input className={inputClass} value={settings?.default_grade_level ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, default_grade_level: event.target.value || null } : current)} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Default grading rules</span>
              <textarea className={textareaClass} value={settings?.default_grading_rules ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, default_grading_rules: event.target.value } : current)} required />
            </label>
            <button className="app-btn app-btn-primary app-btn-lg mt-6" disabled={!settings || saving}>{saving ? "Saving..." : "Save settings"}</button>
          </form>

          <aside className={panelClass}>
            <div className="mb-5">
              <h2 className="font-display text-2xl font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-[#8496B0]">A compact audit trail of teacher actions and system events.</p>
            </div>
            <div className="space-y-3">
              {logs.slice(0, 12).map((log) => (
                <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={log.id}>
                  <div className="font-display text-sm font-semibold text-[#E2EAF4]">{log.action.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-xs text-[#8496B0]">{new Date(log.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!logs.length && <div className="rounded-xl border border-dashed border-[#8496b033] bg-[#0B182966] p-6 text-sm text-[#8496B0]">No audit events yet.</div>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
