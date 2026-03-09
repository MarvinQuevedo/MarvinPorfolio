import { useState } from 'react'
import './App.css'

type InterceptedRequest = {
  id: string;
  method: string;
  path: string;
  timestamp: string;
  mockResponse: any;
};

// Dummy data to show a premium looking UI out of the box
const initialRequests: InterceptedRequest[] = [
  {
    id: 'req-1',
    method: 'GET',
    path: '/api/v1/users/45/orders',
    timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
    mockResponse: {
      status: "success",
      data: {
        userId: 45,
        orders: [
          { id: "ord_001", total: 129.99, status: "shipped" },
          { id: "ord_002", total: 49.50, status: "processing" }
        ]
      }
    }
  },
  {
    id: 'req-2',
    method: 'POST',
    path: '/api/v1/checkout',
    timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
    mockResponse: {
      transactionId: "txn_xyz987",
      status: "success",
      message: "Payment processed using Mock-It-AI dynamically generated rules."
    }
  }
];

function App() {
  const [requests] = useState<InterceptedRequest[]>(initialRequests);
  const [activeReqId, setActiveReqId] = useState<string | null>(initialRequests[0].id);

  const activeRequest = requests.find(r => r.id === activeReqId);

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="header">
        <div className="logo-section">
          <h1>Mock-It-AI</h1>
          <p>AI-Powered API Interception & Mocking</p>
        </div>
        <div className="status-badge">
          <span className="pulsing-dot"></span>
          Proxy Online & Listening
        </div>
      </header>

      <main className="content-grid">
        {/* Left Column: List of Intercepted Requests */}
        <section className="list-section glass">
          <h2>Intercepted 404s</h2>
          
          {requests.length === 0 ? (
            <div className="empty-state">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No requests intercepted yet. Make a request to a missing endpoint!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {requests.map((req) => (
                <div 
                  key={req.id} 
                  className={`request-card ${activeReqId === req.id ? 'active' : ''}`}
                  onClick={() => setActiveReqId(req.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <span className={`method-badge method-${req.method}`}>{req.method}</span>
                      <span className="path">{req.path}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    AI Generated Mock available
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Details & Mock Editor */}
        <section className="details-section glass">
          {activeRequest ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Mock Details</h2>
                <button className="button" onClick={() => alert("Re-generate feature coming soon!")}>Re-generate with AI</button>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Intercepted Path:</p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', fontFamily: 'monospace', color: 'var(--success)', border: '1px solid var(--glass-border)' }}>
                  {activeRequest.method} {activeRequest.path}
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Generated JSON Response:</p>
                <pre className="code-block" style={{ flex: 1, margin: 0 }}>
                  {JSON.stringify(activeRequest.mockResponse, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p>Select a request from the list to view its AI generated mock.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
