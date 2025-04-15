'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Container, Row, Col, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function CalendarTest() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [testType, setTestType] = useState<'all-day' | 'half-day'>('all-day');
  
  const runTest = async () => {
    if (!session) {
      setError('You must be logged in');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Create a simple test leave request
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const leave = {
        start_date: today.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0],
        leave_type: 'Annual',
        reason: 'Calendar API Test',
        status: 'approved',
        is_half_day: testType === 'half-day',
        period: 'morning'
      };
      
      // Create a test leave request
      const response = await axios.post('/api/leave', leave, {
        headers: {
          Authorization: `Bearer ${session.jwt}`
        }
      });
      
      setResult({
        success: true,
        message: 'Test leave created successfully',
        leave: response.data
      });
    } catch (err: any) {
      console.error('Test error:', err);
      setError(err.response?.data?.error || err.message || 'An error occurred');
      setResult({
        success: false,
        message: 'Test failed',
        error: err.response?.data || err.message
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin';
  
  if (!isAdmin) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          Only administrators can access this page.
        </Alert>
        <Link href="/dashboard" className="btn btn-primary mt-3">
          Back to Dashboard
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h1 className="mb-4">Google Calendar Integration Test</h1>
      
      <Card className="mb-4">
        <Card.Header as="h5">Test Calendar Integration</Card.Header>
        <Card.Body>
          <p>This tool will create a test leave request to verify the Google Calendar integration.</p>
          
          <div className="mb-3">
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="testType"
                id="all-day"
                checked={testType === 'all-day'}
                onChange={() => setTestType('all-day')}
              />
              <label className="form-check-label" htmlFor="all-day">
                Test All-Day Leave (date format)
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="testType"
                id="half-day"
                checked={testType === 'half-day'}
                onChange={() => setTestType('half-day')}
              />
              <label className="form-check-label" htmlFor="half-day">
                Test Half-Day Leave (dateTime format)
              </label>
            </div>
          </div>
          
          <Button 
            variant="primary" 
            onClick={runTest}
            disabled={loading}
            style={{ cursor: 'pointer' }}
          >
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                <span className="ms-2">Running test...</span>
              </>
            ) : 'Run Test'}
          </Button>
        </Card.Body>
      </Card>
      
      {error && (
        <Alert variant="danger">
          <h5>Error</h5>
          <p>{error}</p>
        </Alert>
      )}
      
      {result && (
        <Card>
          <Card.Header as="h5">Test Results</Card.Header>
          <Card.Body>
            <Alert variant={result.success ? 'success' : 'warning'}>
              <strong>{result.message}</strong>
            </Alert>
            
            <h6>Details:</h6>
            <pre className="bg-light p-3 rounded" style={{overflowX: 'auto'}}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card.Body>
        </Card>
      )}
      
      <div className="mt-4">
        <Link href="/admin/calendar" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          Back to Calendar Configuration
        </Link>
      </div>
    </Container>
  );
}