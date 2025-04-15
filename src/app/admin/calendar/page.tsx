'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

const CalendarConfigPage = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    calendarId: '',
    calendarName: 'Leave Management',
    leaveType: 'All',
    enabled: true
  });
  
  const [oauthFormData, setOauthFormData] = useState({
    accessToken: '',
    refreshToken: '',
    expiryDate: '',
    showTokenForm: false
  });
  
  interface CalendarConfig {
    id: string;
    calendar_id: string;
    calendar_name: string;
    leave_type: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }
  
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isConnected, setIsConnected] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    success: boolean;
    message: string;
    details?: any;
  }>(null);
  const [testType, setTestType] = useState<'all-day' | 'half-day'>('all-day');
  
  // Google OAuth credential state
  const [googleCredentials, setGoogleCredentials] = useState<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    hasClientSecret: boolean;
  }>({ 
    clientId: '', 
    clientSecret: '', 
    redirectUri: 'https://developers.google.com/oauthplayground',
    hasClientSecret: false
  });
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  // Test Google Calendar API integration by creating a test event
  const testCalendarApi = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    // First check if we're authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      setTestResult({
        success: false,
        message: 'Authentication token not found',
        details: {
          error: 'Please log out and log back in to refresh your session',
          suggestion: 'If problem persists, try clearing browser cache and cookies'
        }
      });
      setIsTesting(false);
      return;
    }
    
    try {
      // Create a simple test leave request
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // The API expects specific field names
      const leave = {
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
        leaveType: 'Annual',
        reason: 'Calendar API Test',
        // Half-day information needs to be in a nested object
        halfDay: testType === 'half-day' 
          ? { isHalfDay: true, period: 'morning' } 
          : { isHalfDay: false, period: null }
      };
      
      // Create a test leave request through the regular API
      const response = await axios.post('/api/leave', leave, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Display success message with calendar event details
      setTestResult({
        success: true,
        message: 'Test leave created successfully and calendar sync attempted',
        details: {
          leaveId: response.data.id,
          leaveDetails: {
            type: leave.leaveType || leave.leave_type,
            dates: `${leave.startDate || leave.start_date} to ${leave.endDate || leave.end_date}`,
            is_half_day: leave.halfDay?.isHalfDay || leave.is_half_day,
            period: leave.halfDay?.period || leave.period
          },
          note: 'Check server logs for calendar sync results',
          checkCalendar: 'Verify that this event appears in your Google Calendar'
        }
      });
    } catch (error: any) {
      console.error('Calendar API test error:', error);
      
      // Provide helpful error message based on error type
      let errorMessage = 'Failed to test calendar integration';
      let errorDetails = error.response?.data || { error: error.message };
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage = 'Authentication error';
        errorDetails = {
          error: 'Your session may have expired',
          suggestion: 'Please log out and log back in to refresh your session'
        };
      }
      
      setTestResult({
        success: false,
        message: errorMessage,
        details: errorDetails
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Check if user is admin
  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (!user || user.role !== 'admin') {
        // Not an admin - redirect
        router.push('/dashboard');
      } else {
        // Admin - init database tables first
        setupDatabase();
      }
    } else if (!loading && !isAuthenticated) {
      // Not authenticated - redirect to login
      router.push('/login');
    }
  }, [loading, isAuthenticated, user, router]);
  
  const setupDatabase = async () => {
    try {
      setIsLoading(true);
      // Setup database tables
      await axios.get('/api/admin/calendar/setup');
      // Then fetch the configuration
      fetchConfig();
      // Fetch Google credentials
      fetchGoogleCredentials();
    } catch (error) {
      console.error('Error setting up database:', error);
      // Continue anyway and try to fetch config
      fetchConfig();
      fetchGoogleCredentials();
    } finally {
      setIsLoading(false);
    }
  };
  
  // Google OAuth credentials management functions
  const fetchGoogleCredentials = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('Authentication token not found');
        return;
      }
      
      const response = await axios.get('/api/admin/calendar/credentials', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setGoogleCredentials({
        clientId: response.data.clientId || '',
        clientSecret: '',  // Client secret is never returned from API
        redirectUri: response.data.redirectUri || 'https://developers.google.com/oauthplayground',
        hasClientSecret: response.data.hasClientSecret || false
      });
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No credentials found, this is expected for new setup
        console.log('No Google credentials found in database');
      } else {
        console.error('Error fetching Google credentials:', error);
        setMessage({
          text: 'Failed to load Google OAuth credentials',
          type: 'error'
        });
      }
    }
  };
  
  const handleCredentialInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGoogleCredentials({
      ...googleCredentials,
      [name]: value
    });
  };
  
  const saveGoogleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSavingCredentials(true);
      setMessage({ text: '', type: '' });
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Only send the required fields
      await axios.post('/api/admin/calendar/credentials', {
        clientId: googleCredentials.clientId,
        clientSecret: googleCredentials.clientSecret,
        redirectUri: googleCredentials.redirectUri
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setMessage({
        text: 'Google OAuth credentials saved successfully',
        type: 'success'
      });
      
      // Update credential state
      fetchGoogleCredentials();
      
      // Hide the form
      setShowCredentialForm(false);
      
    } catch (error) {
      console.error('Error saving Google credentials:', error);
      setMessage({
        text: 'Failed to save Google OAuth credentials',
        type: 'error'
      });
    } finally {
      setIsSavingCredentials(false);
    }
  };
  
  const deleteGoogleCredentials = async () => {
    if (!confirm('Are you sure you want to delete the Google OAuth credentials?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      await axios.delete('/api/admin/calendar/credentials', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setMessage({
        text: 'Google OAuth credentials deleted successfully',
        type: 'success'
      });
      
      // Reset the form
      setGoogleCredentials({
        clientId: '',
        clientSecret: '',
        redirectUri: 'https://developers.google.com/oauthplayground',
        hasClientSecret: false
      });
      
      setShowCredentialForm(false);
      
    } catch (error) {
      console.error('Error deleting Google credentials:', error);
      setMessage({
        text: 'Failed to delete Google OAuth credentials',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // For now, just set a mock connection status
      // In reality, we would check with the backend
      setIsConnected(false);
      
      // Get calendar configurations
      try {
        const configResponse = await axios.get('/api/admin/calendar', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        setCalendarConfigs(configResponse.data || []);
      } catch (configError) {
        console.error('Error fetching calendar configurations:', configError);
        // Tables might not exist yet or some other error
        setCalendarConfigs([]);
      }
      
      setMessage({ text: '', type: '' });
    } catch (error) {
      console.error('Error fetching calendar configuration:', error);
      setMessage({ 
        text: 'Failed to load calendar configuration', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : false;
    
    setFormData({
      ...formData,
      [name]: isCheckbox ? checked : value
    });
  };
  
  const handleOAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setOauthFormData({
      ...oauthFormData,
      [name]: value
    });
  };
  
  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setMessage({ text: '', type: '' });
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      // Convert the expiry date to a timestamp
      const expiryTimestamp = new Date(oauthFormData.expiryDate).getTime();
      
      const dataToSend = {
        access_token: oauthFormData.accessToken,
        refresh_token: oauthFormData.refreshToken,
        expiry_date: expiryTimestamp
      };
      
      await axios.post('/api/admin/calendar/tokens', dataToSend, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      setMessage({ 
        text: 'OAuth tokens saved successfully', 
        type: 'success' 
      });
      
      // Reset form
      setOauthFormData({
        ...oauthFormData,
        accessToken: '',
        refreshToken: '',
        expiryDate: ''
      });
      
      // Update connection status
      setIsConnected(true);
      
    } catch (error) {
      console.error('Error saving OAuth tokens:', error);
      setMessage({ 
        text: error && typeof error === 'object' && 'response' in error 
              && error.response && typeof error.response === 'object' && 'data' in error.response
              ? (error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data 
                 ? error.response.data.error as string : 'Failed to save OAuth tokens') 
              : 'Failed to save OAuth tokens', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setMessage({ text: '', type: '' });
      
      // Validate
      if (!formData.calendarId) {
        setMessage({ text: 'Calendar ID is required', type: 'error' });
        return;
      }
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      const dataToSend = {
        calendar_id: formData.calendarId,
        calendar_name: formData.calendarName,
        leave_type: formData.leaveType,
        is_active: formData.enabled
      };
      
      await axios.post('/api/admin/calendar', dataToSend, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      setMessage({ 
        text: 'Calendar configuration saved successfully', 
        type: 'success' 
      });
      
      // Reset form
      setFormData({
        ...formData,
        calendarId: ''
      });
      
      // Refresh configs
      fetchConfig();
      
    } catch (error) {
      console.error('Error saving calendar configuration:', error);
      setMessage({ 
        text: error && typeof error === 'object' && 'response' in error 
              && error.response && typeof error.response === 'object' && 'data' in error.response
              ? (error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data 
                 ? error.response.data.error as string : 'Failed to save calendar configuration') 
              : 'Failed to save calendar configuration', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this calendar configuration?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      await axios.delete(`/api/admin/calendar/${id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      setMessage({ 
        text: 'Calendar configuration deleted successfully', 
        type: 'success' 
      });
      
      // Refresh configs
      fetchConfig();
      
    } catch (error) {
      console.error('Error deleting calendar configuration:', error);
      setMessage({ 
        text: 'Failed to delete calendar configuration', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const connectGoogle = async () => {
    setMessage({ 
      text: 'Google Calendar integration is coming soon!', 
      type: 'success' 
    });
  };
  
  const testSync = async () => {
    setMessage({ 
      text: 'Test sync feature is coming soon!', 
      type: 'success' 
    });
  };
  
  if (loading || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }
  
  if (user && user.role !== 'admin') {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard">
                  <Image
                    className="h-8 w-auto"
                    src="/leave-logo.svg"
                    alt="LMS"
                    width={120}
                    height={30}
                    priority
                  />
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/admin/users" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  User Management
                </Link>
                <Link href="/admin/slack" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Slack Configuration
                </Link>
                <Link href="/admin/calendar" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Calendar Configuration
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <div className="hidden md:ml-4 md:flex-shrink-0 md:flex md:items-center">
                <div className="ml-3 relative">
                  <div className="text-sm text-gray-700">
                    {user?.name} (Admin)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Google Calendar Configuration
            </h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  {message.text && (
                    <div className={`mb-4 p-4 rounded-md ${
                      message.type === 'error' 
                        ? 'bg-red-50 text-red-800' 
                        : 'bg-green-50 text-green-800'
                    }`}>
                      {message.text}
                    </div>
                  )}
                  
                  {isLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="spinner"></div>
                    </div>
                  ) : (
                    <>
                      {/* Google OAuth Credentials Management Section */}
                      <div className="mb-8 border-b border-gray-200 pb-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">Google OAuth Credentials</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Securely store your Google API credentials in the database
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCredentialForm(!showCredentialForm)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            {showCredentialForm ? 'Cancel' : (googleCredentials.clientId ? 'Edit Credentials' : 'Add Credentials')}
                          </button>
                        </div>
                        
                        {!showCredentialForm && googleCredentials.clientId && (
                          <div className="mt-4 bg-gray-50 p-4 rounded-md">
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                              <div className="sm:col-span-1">
                                <dt className="text-sm font-medium text-gray-500">Client ID</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  {googleCredentials.clientId.substring(0, 15)}...
                                  <span className="text-xs text-gray-500 ml-1">(masked for security)</span>
                                </dd>
                              </div>
                              <div className="sm:col-span-1">
                                <dt className="text-sm font-medium text-gray-500">Client Secret</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  {googleCredentials.hasClientSecret ? "••••••••" : "Not set"}
                                  <span className="text-xs text-gray-500 ml-1">(stored encrypted)</span>
                                </dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-500">Redirect URI</dt>
                                <dd className="mt-1 text-sm text-gray-900 break-all">
                                  {googleCredentials.redirectUri}
                                </dd>
                              </div>
                            </dl>
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={deleteGoogleCredentials}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                Delete Credentials
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {showCredentialForm && (
                          <form onSubmit={saveGoogleCredentials} className="mt-4">
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                              <div className="sm:col-span-6">
                                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                                  Client ID
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="clientId"
                                    id="clientId"
                                    value={googleCredentials.clientId}
                                    onChange={handleCredentialInputChange}
                                    required
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Your Google OAuth Client ID"
                                  />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  From Google Cloud Console, e.g. 123456789-abcdef.apps.googleusercontent.com
                                </p>
                              </div>
                              
                              <div className="sm:col-span-6">
                                <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700">
                                  Client Secret
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                  <input
                                    type={showSecret ? "text" : "password"}
                                    name="clientSecret"
                                    id="clientSecret"
                                    value={googleCredentials.clientSecret}
                                    onChange={handleCredentialInputChange}
                                    required
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Your Google OAuth Client Secret"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                                  >
                                    {showSecret ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                      </svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  Will be encrypted before storing in the database.
                                </p>
                              </div>
                              
                              <div className="sm:col-span-6">
                                <label htmlFor="redirectUri" className="block text-sm font-medium text-gray-700">
                                  Redirect URI
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="redirectUri"
                                    id="redirectUri"
                                    value={googleCredentials.redirectUri}
                                    onChange={handleCredentialInputChange}
                                    required
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Redirect URI for OAuth flow"
                                  />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  For testing, you can use the Google OAuth Playground: https://developers.google.com/oauthplayground
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end space-x-3">
                              <button
                                type="button"
                                onClick={() => setShowCredentialForm(false)}
                                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingCredentials}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                {isSavingCredentials ? 'Saving...' : 'Save Credentials'}
                              </button>
                            </div>
                          </form>
                        )}
                        
                        {!showCredentialForm && (
                          <div className="mt-4 rounded-md bg-blue-50 p-4">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2h1v3a1 1 0 102 0v-3a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">Security Information</h3>
                                <div className="mt-2 text-sm text-blue-700">
                                  <ul className="list-disc pl-5 space-y-1">
                                    <li>Credentials are encrypted before storage</li>
                                    <li>Your client secret is never exposed in API responses</li>
                                    <li>Credentials are accessible only to administrators</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Google Calendar Connection Section */}
                      <div className="mb-8 border-b border-gray-200 pb-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">Google Calendar Connection</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {isConnected 
                                ? "Your account is connected to Google Calendar." 
                                : "Connect your Google account to enable calendar integration."}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => setOauthFormData(prev => ({ ...prev, showTokenForm: !prev.showTokenForm }))}  
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              {oauthFormData.showTokenForm ? 'Hide Token Form' : 'Manual Token Entry'}
                            </button>
                            <button
                              type="button"
                              onClick={connectGoogle}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Connect to Google Calendar
                            </button>
                          </div>
                        </div>
                        
                        {oauthFormData.showTokenForm && (
                          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                            <h4 className="text-md font-medium text-gray-900 mb-2">Manual OAuth Token Entry</h4>
                            <p className="text-sm text-gray-500 mb-4">
                              Enter your Google OAuth tokens manually. This is for advanced users who have already
                              created OAuth credentials in the Google Cloud Console.
                            </p>
                            
                            <form onSubmit={handleTokenSubmit} className="space-y-4">
                              <div>
                                <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                                  Access Token
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="accessToken"
                                    id="accessToken"
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Enter OAuth Access Token"
                                    value={oauthFormData.accessToken}
                                    onChange={handleOAuthInputChange}
                                    required
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label htmlFor="refreshToken" className="block text-sm font-medium text-gray-700">
                                  Refresh Token
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="refreshToken"
                                    id="refreshToken"
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Enter OAuth Refresh Token"
                                    value={oauthFormData.refreshToken}
                                    onChange={handleOAuthInputChange}
                                    required
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">
                                  Expiry Date
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="datetime-local"
                                    name="expiryDate"
                                    id="expiryDate"
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    value={oauthFormData.expiryDate}
                                    onChange={handleOAuthInputChange}
                                    required
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  Save OAuth Tokens
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                        
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={testSync}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Test Calendar Sync
                          </button>
                          <p className="mt-1 text-xs text-gray-500">
                            This will sync a sample leave request to test the calendar integration.
                          </p>
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Calendar Configurations</h3>
                      
                      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
                        <div>
                          <label htmlFor="calendarId" className="block text-sm font-medium text-gray-700">
                            Google Calendar ID
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              name="calendarId"
                              id="calendarId"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Enter Google Calendar ID"
                              value={formData.calendarId}
                              onChange={handleInputChange}
                              required
                            />
                            <p className="mt-2 text-sm text-gray-500">
                              Enter your Google Calendar ID or use "primary" for your default calendar
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="calendarName" className="block text-sm font-medium text-gray-700">
                            Calendar Display Name
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              name="calendarName"
                              id="calendarName"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Enter a display name for this calendar"
                              value={formData.calendarName}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700">
                            Leave Type
                          </label>
                          <div className="mt-1">
                            <select
                              id="leaveType"
                              name="leaveType"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={formData.leaveType}
                              onChange={handleInputChange}
                              required
                            >
                              <option value="All">All Leave Types</option>
                              <option value="Annual">Annual</option>
                              <option value="Sick">Sick</option>
                              <option value="Personal">Personal</option>
                              <option value="Other">Other</option>
                            </select>
                            <p className="mt-2 text-sm text-gray-500">
                              Specify which leave types will be synced to this calendar.
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="enabled"
                              name="enabled"
                              type="checkbox"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={formData.enabled}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="enabled" className="font-medium text-gray-700">Active</label>
                            <p className="text-gray-500">When enabled, leave requests will be synchronized with this calendar.</p>
                          </div>
                        </div>
                        
                        <div>
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            {isSaving ? 'Saving...' : 'Add Calendar Configuration'}
                          </button>
                        </div>
                      </form>
                      
                      <div className="mt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Configured Calendars</h3>
                        
                        {calendarConfigs.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Calendar Name
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Calendar ID
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Leave Type
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {calendarConfigs.map((config: CalendarConfig) => (
                                  <tr key={config.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {config.calendar_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {config.calendar_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {config.leave_type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {config.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      <button
                                        onClick={() => handleDelete(config.id)}
                                        className="text-red-600 hover:text-red-900"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No calendar configurations found. Add one using the form above.</p>
                        )}
                      </div>

                      {/* Google Calendar API Test Section */}
                      {isConnected && calendarConfigs.length > 0 && (
                        <div className="mt-10 px-4 py-5 sm:p-6 bg-white shadow rounded-lg">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                            Test Google Calendar Integration
                          </h3>
                          <p className="text-sm text-gray-500 mb-5">
                            Verify your Google Calendar integration is working correctly by creating a test leave request that will sync to your calendar.
                          </p>
                          
                          <div className="mb-5 flex flex-col">
                            <label className="text-sm font-medium text-gray-700 mb-2">Test Event Type</label>
                            <div className="flex items-center space-x-5">
                              <div className="flex items-center">
                                <input
                                  type="radio"
                                  id="all-day"
                                  name="testType"
                                  value="all-day"
                                  checked={testType === 'all-day'}
                                  onChange={() => setTestType('all-day')}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="all-day" className="ml-2 block text-sm text-gray-700">
                                  All-day Leave (multiple days)
                                </label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="radio"
                                  id="half-day"
                                  name="testType"
                                  value="half-day"
                                  checked={testType === 'half-day'}
                                  onChange={() => setTestType('half-day')}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="half-day" className="ml-2 block text-sm text-gray-700">
                                  Half-day Leave (AM)
                                </label>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <button
                              type="button"
                              onClick={testCalendarApi}
                              disabled={isTesting}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              style={{ cursor: 'pointer' }}
                            >
                              {isTesting ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Testing...
                                </>
                              ) : (
                                'Create Test Event'
                              )}
                            </button>
                          </div>
                          
                          {testResult && (
                            <div className={`mt-4 p-4 rounded-md ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="flex">
                                <div className="flex-shrink-0">
                                  {testResult.success ? (
                                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <div className="ml-3">
                                  <h3 className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {testResult.message}
                                  </h3>
                                  {testResult.details && (
                                    <div className="mt-2 text-sm text-gray-700">
                                      <pre className="whitespace-pre-wrap">{JSON.stringify(testResult.details, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CalendarConfigPage;
