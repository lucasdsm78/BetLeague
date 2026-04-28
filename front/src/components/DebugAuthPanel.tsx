import React, { useEffect, useState } from 'react';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';

interface HealthStatus {
  status: 'pending' | 'ok' | 'fail' | 'timeout';
  detail?: string;
  latencyMs?: number;
}

const DebugAuthPanel: React.FC = () => {
  const { debugDumpAuth, attemptHydrateFromAnyStorage, recoverFromStoredToken } = useEnhancedAuth({ debugMode: true });
  const [health, setHealth] = useState<HealthStatus>({ status: 'pending' });
  const [dump, setDump] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (debugDumpAuth) setDump(debugDumpAuth());
  }, [debugDumpAuth]);

  useEffect(() => {
    // Test /health avec timeout plus court pour feedback rapide
    const controller = new AbortController();
    const start = performance.now();
    const timeout = setTimeout(() => {
      controller.abort();
      setHealth({ status: 'timeout', detail: 'Timeout après 3s' });
    }, 3000);

    fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/health`, {
      signal: controller.signal,
    })
      .then(async r => {
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - start);
        if (r.ok) {
          setHealth({ status: 'ok', latencyMs });
        } else {
          setHealth({ status: 'fail', detail: `HTTP ${r.status}`, latencyMs });
        }
      })
      .catch(e => {
        if (controller.signal.aborted) return; // déjà géré
        setHealth({ status: 'fail', detail: e.message });
      });

    return () => clearTimeout(timeout);
  }, []);

  const forceHydrate = () => {
    const any = attemptHydrateFromAnyStorage?.();
    const rec = !any && recoverFromStoredToken?.();
    setDump(debugDumpAuth?.() || {});
    alert(`Hydration résultat => anyStorage:${any} recover:${rec}`);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 8,
      right: 8,
      zIndex: 2000,
      fontFamily: 'monospace',
      background: '#111',
      color: '#eee',
      padding: '8px 12px',
      borderRadius: 6,
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      maxWidth: 340,
      fontSize: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
           onClick={() => setExpanded(e => !e)}>
        <strong>Auth Debug</strong>
        <span>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 6 }}>
          <div>
            <strong>Health:</strong> {health.status} {health.latencyMs !== undefined && `(${health.latencyMs}ms)`} {health.detail && `- ${health.detail}`}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto', background: '#222', padding: 6, borderRadius: 4 }}>
{JSON.stringify(dump, null, 2)}
          </pre>
          <button style={{
            background: '#444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer'
          }} onClick={forceHydrate}>Hydrater manuellement</button>
        </div>
      )}
    </div>
  );
};

export default DebugAuthPanel;

