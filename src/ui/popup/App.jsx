import React, { useState, useEffect } from 'react';
import { MESSAGE_TYPES } from '../../shared/index.js';
import './App.css';

function App() {
  const [authStatus, setAuthStatus] = useState(null);
  const [lastSync, setLastSync] = useState('Never');
  const [cachedOrders, setCachedOrders] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mode, setMode] = useState('auto');
  const [useCache, setUseCache] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  // Load initial status
  const loadStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS });

      if (response.authStatus) {
        setAuthStatus(response.authStatus);
      }

      if (response.lastSync) {
        setLastSync(formatDate(response.lastSync));
      }

      if (response.processedOrderCount !== undefined) {
        setCachedOrders(response.processedOrderCount);
      }

      if (response.syncStatus) {
        setSyncStatus(response.syncStatus);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  // Check authentication
  const checkAuth = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHECK_AUTH });
      setAuthStatus(response);
    } catch (error) {
      console.error('Error checking auth:', error);
      setAuthStatus({ authenticated: false, message: 'Error checking authentication' });
    }
  };

  // Sync orders
  const syncOrders = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setResults(null);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SYNC_ORDERS,
        options: {
          useCache,
          mode,
          limit: 10
        }
      });

      if (response.success) {
        console.log('Sync completed successfully');
        loadStatus();
      } else {
        setError(response.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
      setError('Failed to sync orders');
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear cache
  const clearCache = async () => {
    if (confirm('This will clear all cached order data. Continue?')) {
      try {
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_CACHE });
        setCachedOrders(0);
        alert('Cache cleared successfully');
      } catch (error) {
        console.error('Error clearing cache:', error);
        alert('Failed to clear cache');
      }
    }
  };

  // Listen for status updates
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === 'SYNC_STATUS_UPDATE') {
        setSyncStatus({
          status: message.payload.status,
          details: message.payload.details
        });

        if (message.payload.status === 'complete') {
          setResults(message.payload.details);
        } else if (message.payload.status === 'error') {
          setError(message.payload.details.message || 'An error occurred');
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Initialize
  useEffect(() => {
    loadStatus();
    checkAuth();

    // Refresh status periodically
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Render auth status
  const renderAuthStatus = () => {
    if (!authStatus) {
      return (
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span className="status-text">Checking...</span>
        </div>
      );
    }

    const statusClass = authStatus.authenticated ? 'authenticated' : 'error';
    const statusText = authStatus.authenticated 
      ? 'Logged in to Walmart' 
      : (authStatus.message || 'Not logged in');

    return (
      <div className="status-indicator">
        <span className={`status-dot ${statusClass}`}></span>
        <span className="status-text">{statusText}</span>
      </div>
    );
  };

  // Render progress
  const renderProgress = () => {
    if (!syncStatus || syncStatus.status === 'idle') return null;

    const { status, details } = syncStatus;
    const statusText = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    let progressPercent = 0;
    let progressText = 'Processing...';

    if (status === 'fetching_orders' || status === 'fetching_details') {
      if (details?.total) {
        progressPercent = (details.current / details.total) * 100;
        progressText = `${details.current} / ${details.total}`;
      } else {
        progressPercent = 50;
        progressText = details?.message || 'Processing...';
      }
    } else if (status === 'processing') {
      progressPercent = 90;
      progressText = 'Processing data...';
    }

    return (
      <>
        <div className="info-item">
          <span className="info-label">Status:</span>
          <span className="info-value">{statusText}</span>
        </div>
        {progressPercent > 0 && (
          <section className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="progress-text">{progressText}</div>
          </section>
        )}
      </>
    );
  };

  // Render results
  const renderResults = () => {
    if (!results) return null;

    return (
      <section className="results-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Sync Results</h3>
          <span className="badge badge-success">
            <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            Success
          </span>
        </div>
        <div className="results-content">
          {results.orderCount === 0 ? (
            <p>
              No new orders to sync.
              {results.totalOrders && ` (${results.totalOrders} orders already processed)`}
            </p>
          ) : (
            <>
              <table className="summary-table">
                <tbody>
                  <tr>
                    <td>Orders</td>
                    <td>{results.orderCount}</td>
                  </tr>
                  {results.itemCount && (
                    <tr>
                      <td>Items</td>
                      <td>{results.itemCount}</td>
                    </tr>
                  )}
                  {results.extractionMode && (
                    <tr>
                      <td>Mode</td>
                      <td>{results.extractionMode === 'api' ? 'API' : 'Content Script'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                Check the browser console to see the formatted data.
              </p>
            </>
          )}
        </div>
      </section>
    );
  };

  // Render error
  const renderError = () => {
    if (!error) return null;

    return (
      <section className="error-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="badge badge-error">
            <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            Error
          </span>
        </div>
        <div className="error-message">{error}</div>
      </section>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>Walmart-Monarch Sync</h1>
        {renderAuthStatus()}
      </header>

      <main>
        <section className="info-section">
          <div className="info-item">
            <span className="info-label">Last Sync:</span>
            <span className="info-value">{lastSync}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Cached Orders:</span>
            <span className="info-value">{cachedOrders}</span>
          </div>
          {renderProgress()}
        </section>

        <section className="actions-section">
          <button 
            className="btn btn-primary" 
            disabled={!authStatus?.authenticated || isSyncing}
            onClick={syncOrders}
          >
            <span className="btn-text">{isSyncing ? 'Syncing...' : 'Sync Orders'}</span>
            {isSyncing && <span className="spinner"></span>}
          </button>
          
          <button className="btn btn-secondary" onClick={clearCache}>
            Clear Cache
          </button>

          <div className="select-group">
            <label htmlFor="modeSelect">Extraction Mode:</label>
            <select id="modeSelect" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="auto">Auto (API → Content Script)</option>
              <option value="api">API Only (Fast)</option>
              <option value="content">Content Script Only (Reliable)</option>
            </select>
          </div>

          <div className="checkbox-group">
            <label>
              <input 
                type="checkbox" 
                checked={useCache}
                onChange={(e) => setUseCache(e.target.checked)}
              />
              <span>Skip already processed orders</span>
            </label>
          </div>
        </section>

        {renderResults()}
        {renderError()}
      </main>

      <footer>
        <div className="footer-text">
          Open browser console to see order data
        </div>
      </footer>
    </div>
  );
}

export default App;