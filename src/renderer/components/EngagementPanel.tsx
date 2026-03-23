import React, { useMemo, useState } from 'react';
import type { Engagement } from '@shared/types';
import { DEFAULT_ENGAGEMENT_ID } from '@shared/constants';

interface EngagementPanelProps {
  engagements: Engagement[];
  currentEngagementId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSave: (engagement: Partial<Engagement> & { name: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyDraft = {
  id: null as string | null,
  name: '',
  primaryTarget: '',
};

const EngagementPanel: React.FC<EngagementPanelProps> = ({
  engagements,
  currentEngagementId,
  onClose,
  onSelect,
  onSave,
  onDelete,
}) => {
  const [draft, setDraft] = useState(emptyDraft);

  const selectedEngagement = useMemo(
    () => engagements.find((engagement) => engagement.id === draft.id) ?? null,
    [draft.id, engagements]
  );

  const handleSubmit = async () => {
    const name = draft.name.trim();
    if (!name) return;
    await onSave({
      id: draft.id ?? undefined,
      name,
      primaryTarget: draft.primaryTarget.trim(),
    });
    setDraft(emptyDraft);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="engagement-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">Engagements</span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="engagement-layout">
          <div className="engagement-list">
            {engagements.map((engagement) => (
              <button
                key={engagement.id}
                className={`engagement-row ${engagement.id === currentEngagementId ? 'active' : ''}`}
                onClick={() => setDraft({
                  id: engagement.id,
                  name: engagement.name,
                  primaryTarget: engagement.primaryTarget ?? '',
                })}
              >
                <div className="engagement-row-header">
                  <span className="engagement-row-title">{engagement.name}</span>
                  {engagement.id === currentEngagementId && (
                    <span className="engagement-current-pill">live</span>
                  )}
                </div>
                <div className="engagement-row-meta">
                  <span>{engagement.primaryTarget || 'no target yet'}</span>
                  <span>{new Date(engagement.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="engagement-row-actions">
                  <span
                    className="action-btn primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(engagement.id);
                    }}
                  >
                    switch
                  </span>
                  {engagement.id !== DEFAULT_ENGAGEMENT_ID && (
                    <span
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDelete(engagement.id);
                      }}
                    >
                      archive
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="engagement-editor">
            <div className="section-label">
              {selectedEngagement ? 'Edit Engagement' : 'New Engagement'}
            </div>

            <input
              className="search-input"
              placeholder="Engagement name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="search-input"
              placeholder="Primary target"
              value={draft.primaryTarget}
              onChange={(e) => setDraft((prev) => ({ ...prev, primaryTarget: e.target.value }))}
            />

            <div className="engagement-editor-hint">
              Notes, findings, history, and loot views follow the active engagement.
            </div>

            <div className="engagement-editor-actions">
              <button className="action-btn" onClick={() => setDraft(emptyDraft)}>
                new
              </button>
              <button className="action-btn primary" onClick={() => void handleSubmit()}>
                {selectedEngagement ? 'save changes' : 'create engagement'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngagementPanel;
