import React, { useState, useCallback, useMemo } from 'react';

export interface Credential {
  id: string;
  username: string;
  password: string;
  hash?: string;
  type: 'password' | 'hash' | 'key' | 'token';
  source: string;
  accessTo: string;
  status: 'working' | 'expired' | 'unverified';
  createdAt: string;
}

interface CredentialVaultProps {
  credentials: Credential[];
  onSave: (cred: Omit<Credential, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  onUseCredential: (cred: Credential, tool: string) => void;
  onClose: () => void;
}

const EMPTY_CRED = {
  username: '',
  password: '',
  hash: '',
  type: 'password' as Credential['type'],
  source: '',
  accessTo: '',
  status: 'unverified' as Credential['status'],
};

const CredentialVault: React.FC<CredentialVaultProps> = ({
  credentials,
  onSave,
  onDelete,
  onUseCredential,
  onClose,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CRED);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return credentials;
    const lower = filter.toLowerCase();
    return credentials.filter(c =>
      c.username.toLowerCase().includes(lower) ||
      c.source.toLowerCase().includes(lower) ||
      c.accessTo.toLowerCase().includes(lower)
    );
  }, [credentials, filter]);

  const handleSubmit = useCallback(() => {
    if (!draft.username && !draft.hash) return;
    onSave(draft);
    setDraft(EMPTY_CRED);
    setShowAdd(false);
  }, [draft, onSave]);

  const statusColor = (status: Credential['status']) => {
    switch (status) {
      case 'working': return '#4ade80';
      case 'expired': return '#f87171';
      case 'unverified': return '#fbbf24';
    }
  };

  const typeIcon = (type: Credential['type']) => {
    switch (type) {
      case 'password': return '***';
      case 'hash': return '#H';
      case 'key': return 'KEY';
      case 'token': return 'TKN';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="container-panel" style={{ width: 560, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            Credential Vault
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>{credentials.length} stored</span>
          </span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="container-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '70vh', overflow: 'hidden' }}>
          {/* Search + Add */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              className="search-input"
              placeholder="Search credentials..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-accent"
              onClick={() => setShowAdd(!showAdd)}
              style={{ padding: '4px 12px', fontSize: 11, whiteSpace: 'nowrap' }}
            >
              {showAdd ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
              padding: 10, background: 'var(--bg2)', borderRadius: 6, flexShrink: 0,
            }}>
              <input className="search-input" placeholder="Username" value={draft.username}
                onChange={e => setDraft(d => ({ ...d, username: e.target.value }))} />
              <input className="search-input" placeholder="Password" value={draft.password}
                onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} />
              <input className="search-input" placeholder="Hash (optional)" value={draft.hash}
                onChange={e => setDraft(d => ({ ...d, hash: e.target.value }))} />
              <select className="search-input" value={draft.type}
                onChange={e => setDraft(d => ({ ...d, type: e.target.value as Credential['type'] }))}>
                <option value="password">Password</option>
                <option value="hash">Hash</option>
                <option value="key">SSH Key</option>
                <option value="token">Token</option>
              </select>
              <input className="search-input" placeholder="Source (e.g. /etc/shadow)" value={draft.source}
                onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} />
              <input className="search-input" placeholder="Access to (e.g. SSH, Admin panel)" value={draft.accessTo}
                onChange={e => setDraft(d => ({ ...d, accessTo: e.target.value }))} />
              <select className="search-input" value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as Credential['status'] }))}>
                <option value="unverified">Unverified</option>
                <option value="working">Working</option>
                <option value="expired">Expired</option>
              </select>
              <button className="btn-accent" onClick={handleSubmit} style={{ padding: '6px 12px', fontSize: 11 }}>
                Save Credential
              </button>
            </div>
          )}

          {/* Credential list */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)', fontSize: 12 }}>
                {credentials.length === 0 ? 'No credentials stored yet. Add one above or let the AI discover them.' : 'No matches.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map(cred => (
                  <div key={cred.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', background: 'var(--bg2)', borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}>
                    {/* Type badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 5px',
                      borderRadius: 3, background: 'var(--bg3)', color: 'var(--text2)',
                      fontFamily: 'monospace', minWidth: 28, textAlign: 'center',
                    }}>
                      {typeIcon(cred.type)}
                    </span>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{cred.username}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>:</span>
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace' }}>
                          {cred.password || cred.hash?.slice(0, 20) + '...' || '(no password)'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8 }}>
                        {cred.source && <span>from: {cred.source}</span>}
                        {cred.accessTo && <span>access: {cred.accessTo}</span>}
                      </div>
                    </div>

                    {/* Status dot */}
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColor(cred.status), flexShrink: 0,
                    }} title={cred.status} />

                    {/* Quick use buttons */}
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {cred.password && (
                        <button
                          onClick={() => onUseCredential(cred, 'ssh')}
                          style={{
                            padding: '2px 6px', fontSize: 9, background: 'var(--bg3)',
                            border: '1px solid var(--border)', borderRadius: 3,
                            color: 'var(--text2)', cursor: 'pointer',
                          }}
                          title={`ssh ${cred.username}@target`}
                        >
                          SSH
                        </button>
                      )}
                      <button
                        onClick={() => { navigator.clipboard.writeText(cred.password || cred.hash || ''); }}
                        style={{
                          padding: '2px 6px', fontSize: 9, background: 'var(--bg3)',
                          border: '1px solid var(--border)', borderRadius: 3,
                          color: 'var(--text2)', cursor: 'pointer',
                        }}
                        title="Copy password/hash"
                      >
                        CP
                      </button>
                      <button
                        onClick={() => onDelete(cred.id)}
                        style={{
                          padding: '2px 6px', fontSize: 9, background: 'none',
                          border: '1px solid var(--border)', borderRadius: 3,
                          color: 'var(--text3)', cursor: 'pointer',
                        }}
                        title="Delete"
                      >
                        x
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CredentialVault;
