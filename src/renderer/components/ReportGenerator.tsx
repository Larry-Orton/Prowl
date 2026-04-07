import React, { useState, useCallback } from 'react';
import { Note, ActiveContext } from '@shared/types';
import { Credential } from './CredentialVault';

interface ReportGeneratorProps {
  target: string;
  hostname?: string;
  engagementName: string;
  notes: Note[];
  credentials: Credential[];
  context: ActiveContext;
  onGenerate: (prompt: string) => Promise<string | null>;
  onClose: () => void;
}

type ReportSection = 'executive' | 'methodology' | 'findings' | 'credentials' | 'remediation' | 'full';

const REPORT_SECTIONS: { id: ReportSection; label: string; description: string }[] = [
  { id: 'full', label: 'Full Report', description: 'Complete pentest report with all sections' },
  { id: 'executive', label: 'Executive Summary', description: 'High-level overview for management' },
  { id: 'findings', label: 'Technical Findings', description: 'Detailed vulnerability findings with evidence' },
  { id: 'methodology', label: 'Methodology', description: 'Tools and techniques used' },
  { id: 'credentials', label: 'Credentials Found', description: 'All discovered credentials and access' },
  { id: 'remediation', label: 'Remediation', description: 'Fix recommendations for each finding' },
];

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  target,
  hostname,
  engagementName,
  notes,
  credentials,
  context,
  onGenerate,
  onClose,
}) => {
  const [selectedSection, setSelectedSection] = useState<ReportSection>('full');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState('');

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setReport('');

    // Read journal and target.md for context
    let journal = '';
    let targetMd = '';
    try {
      journal = await window.electronAPI.workspace.readFile(`/workspace/${target}/journal.md`) || '';
      targetMd = await window.electronAPI.workspace.readFile(`/workspace/${target}/target.md`) || '';
    } catch { /* ignore */ }

    const credentialsSummary = credentials.length > 0
      ? credentials.map(c => `- ${c.username}:${c.password || c.hash || '(no password)'} [${c.type}] via ${c.source} → ${c.accessTo} (${c.status})`).join('\n')
      : '(none found)';

    const notesSummary = notes.slice(0, 20).map(n => `- ${n.title}: ${n.content.slice(0, 200)}`).join('\n');

    const portsSummary = context.discoveredPorts.length > 0
      ? context.discoveredPorts.join(', ')
      : '(none discovered)';

    const servicesSummary = context.scannedServices.length > 0
      ? context.scannedServices.join(', ')
      : '(none identified)';

    const sectionInstructions = selectedSection === 'full'
      ? 'Write a complete penetration testing report with: Executive Summary, Scope, Methodology, Findings (each with severity, description, evidence, impact, remediation), Credentials Discovered, and Conclusion.'
      : selectedSection === 'executive'
        ? 'Write only the Executive Summary section — high-level overview suitable for management.'
        : selectedSection === 'findings'
          ? 'Write detailed Technical Findings — each finding with severity (Critical/High/Medium/Low), description, evidence from the engagement, impact, and proof of concept.'
          : selectedSection === 'methodology'
            ? 'Write the Methodology section — tools used, techniques applied, and approach taken.'
            : selectedSection === 'credentials'
              ? 'Write the Credentials section — all discovered credentials, where they were found, what they access, and their current status.'
              : 'Write Remediation recommendations for each finding identified in the engagement.';

    const prompt = `Generate a professional penetration testing report for:

Target: ${target}${hostname ? ` (${hostname})` : ''}
Engagement: ${engagementName}
Discovered Ports: ${portsSummary}
Services: ${servicesSummary}

${sectionInstructions}

## Available Context

### Target Memory (target.md):
${targetMd || '(none)'}

### Engagement Journal:
${journal.slice(-6000) || '(none)'}

### Notes:
${notesSummary || '(none)'}

### Credentials Found:
${credentialsSummary}

Format the report in clean Markdown. Be specific — reference actual findings, ports, services, and credentials from the engagement data. Include severity ratings. Write like a professional pentester delivering a report to a client.`;

    try {
      const result = await onGenerate(prompt);
      if (result) {
        setReport(result);
      } else {
        setReport('Failed to generate report. Check your API key and try again.');
      }
    } catch (err) {
      setReport(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [target, hostname, engagementName, notes, credentials, context, selectedSection, onGenerate]);

  const handleExport = useCallback(async () => {
    if (!report) return;
    await window.electronAPI.dialog.saveFile(report, `${engagementName}-report.md`);
  }, [report, engagementName]);

  const handleCopy = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(report);
  }, [report]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="container-panel" style={{ width: 640, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Report Generator
          </span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="container-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '80vh', overflow: 'hidden' }}>
          {!report ? (
            <>
              {/* Section picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {REPORT_SECTIONS.map(section => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '8px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      background: selectedSection === section.id ? 'var(--accent)' : 'var(--bg2)',
                      color: selectedSection === section.id ? 'white' : 'var(--text1)',
                      border: selectedSection === section.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{section.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{section.description}</span>
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <button
                className="btn-accent"
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6 }}
              >
                {isGenerating ? 'Generating report...' : `Generate ${REPORT_SECTIONS.find(s => s.id === selectedSection)?.label}`}
              </button>

              {isGenerating && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>
                  The AI is compiling your report from the engagement journal, findings, and notes. This may take 15-30 seconds...
                </div>
              )}
            </>
          ) : (
            <>
              {/* Report viewer */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn-accent" onClick={handleExport} style={{ padding: '6px 12px', fontSize: 11 }}>
                  Export .md
                </button>
                <button className="btn-accent" onClick={handleCopy} style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg3)', color: 'var(--text1)' }}>
                  Copy to clipboard
                </button>
                <button className="btn-accent" onClick={() => setReport('')} style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg3)', color: 'var(--text1)' }}>
                  Back
                </button>
              </div>
              <div style={{
                flex: 1, overflow: 'auto', padding: 14,
                background: 'var(--bg0)', borderRadius: 6, border: '1px solid var(--border)',
                fontSize: 12, lineHeight: 1.7, color: 'var(--text1)',
                fontFamily: '"JetBrains Mono", monospace',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                userSelect: 'text',
              }}>
                {report}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
