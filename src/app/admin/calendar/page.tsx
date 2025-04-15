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
            type: leave.leave_type,
            dates: `${leave.start_date} to ${leave.end_date}`,
            is_half_day: leave.is_half_day,
            period: leave.period
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
      // Setup database tables
      await axios.get('/api/admin/calendar/setup');
      // Then fetch the configuration
      fetchConfig();
    } catch (error) {
      console.error('Error setting up database:', error);
      // Continue anyway and try to fetch config
      fetchConfig();
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
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
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
