import React from 'react';

export function SessionDivider({ timestamp }) {
  return (
    <div className="session-divider">
      <span>
        Nouvelle session — {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
