'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

const SlackConfigPage = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    token: '',
    channelId: '',
    enabled: true,
    dayRange: 3,
    scheduleEnabled: true,
    scheduleTime: '08:30',
    scheduleWorkdaysOnly: true
  });
  
  const [savedToken, setSavedToken] = useState(''); // For display purposes
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Check if user is admin
  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (!user || user.role !== 'admin') {
        // Not an admin - redirect
        router.push('/dashboard');
      } else {
        // Admin - fetch config
        fetchConfig();
      }
    } else if (!loading && !isAuthenticated) {
      // Not authenticated - redirect to login
      router.push('/login');
    }
  }, [loading, isAuthenticated, user, router]);
  
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await axios.get('/api/admin/slack-config', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const config = response.data;
      setFormData({
        token: '',  // Don't populate the real token for security
        channelId: config.channelId || '',
        enabled: config.enabled,
        dayRange: config.dayRange || 3,
        scheduleEnabled: config.scheduleEnabled !== undefined ? config.scheduleEnabled : true,
        scheduleTime: config.scheduleTime || '08:30',
        scheduleWorkdaysOnly: config.scheduleWorkdaysOnly !== undefined ? config.scheduleWorkdaysOnly : true
      });
      
      // For displaying masked token in UI
      setSavedToken(config.token || '');
      
      setMessage({ text: '', type: '' });
    } catch (error) {
      console.error('Error fetching Slack configuration:', error);
      setMessage({ 
        text: 'Failed to load Slack configuration', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setMessage({ text: '', type: '' });
      
      // Validate
      if (!formData.token && !savedToken) {
        setMessage({ text: 'Slack token is required', type: 'error' });
        return;
      }
      
      if (!formData.channelId) {
        setMessage({ text: 'Slack channel ID is required', type: 'error' });
        return;
      }
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      // If token field is empty and there's a saved token, don't update the token
      const dataToSend = {
        ...formData,
        token: formData.token || savedToken
      };
      
      const response = await axios.post('/api/admin/slack-config', dataToSend, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      // Update the displayed token (masked)
      setSavedToken(response.data.token || '');
      
      // Clear the token input for security
      setFormData({
        ...formData,
        token: ''
      });
      
      setMessage({ 
        text: 'Slack configuration saved successfully', 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Error saving Slack configuration:', error);
      setMessage({ 
        text: 'Failed to save Slack configuration', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setMessage({ text: '', type: '' });
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      // Send the test message and ignore the response
      await axios.patch('/api/admin/slack-config?action=test', {}, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      setMessage({ 
        text: 'Test message sent successfully! Check your Slack channel.', 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Error testing Slack connection:', error);
      setMessage({ 
        text: 'Failed to send test message to Slack', 
        type: 'error' 
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleSendSummary = async () => {
    try {
      setIsTesting(true);
      setMessage({ text: '', type: '' });
      
      // Get token from localStorage
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      // Send the summary message and ignore the response
      await axios.patch('/api/admin/slack-config?action=summary', {}, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      setMessage({ 
        text: 'Leave summary sent successfully! Check your Slack channel.', 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Error sending leave summary:', error);
      setMessage({ 
        text: 'Failed to send leave summary to Slack', 
        type: 'error' 
      });
    } finally {
      setIsTesting(false);
    }
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
                <Link href="/admin/slack" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Slack Configuration
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
              Slack Configuration
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
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                          <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                            Slack Bot Token
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              name="token"
                              id="token"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder={savedToken ? '•••••••••••••••••••••••••••' : 'Enter Slack Bot Token'}
                              value={formData.token}
                              onChange={handleInputChange}
                            />
                            {savedToken && (
                              <p className="mt-2 text-sm text-gray-500">
                                A token is already saved. Enter a new one only if you want to change it.
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="channelId" className="block text-sm font-medium text-gray-700">
                            Slack Channel ID
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              name="channelId"
                              id="channelId"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Enter Slack Channel ID"
                              value={formData.channelId}
                              onChange={handleInputChange}
                              required
                            />
                            <p className="mt-2 text-sm text-gray-500">
                              This is the channel where leave notifications will be sent. Format: C01234ABCDE
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="dayRange" className="block text-sm font-medium text-gray-700">
                            Day Range for Leave Summary
                          </label>
                          <div className="mt-1">
                            <input
                              type="number"
                              name="dayRange"
                              id="dayRange"
                              min="1"
                              max="30"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={formData.dayRange}
                              onChange={handleInputChange}
                              required
                            />
                            <p className="mt-2 text-sm text-gray-500">
                              Number of days to include in the leave summary (1-30 days).
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative flex items-start mb-6">
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
                            <label htmlFor="enabled" className="font-medium text-gray-700">Enable Slack Notifications</label>
                            <p className="text-gray-500">When enabled, leave requests will trigger Slack notifications.</p>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-6 mb-6">
                          <h3 className="text-lg font-medium text-gray-900">Scheduled Notifications</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Configure when to send daily leave summary notifications to Slack.
                          </p>
                        </div>
                        
                        <div className="relative flex items-start mb-4">
                          <div className="flex items-center h-5">
                            <input
                              id="scheduleEnabled"
                              name="scheduleEnabled"
                              type="checkbox"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={formData.scheduleEnabled}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="scheduleEnabled" className="font-medium text-gray-700">Enable Scheduled Summary</label>
                            <p className="text-gray-500">When enabled, a daily summary of leave requests will be sent to Slack.</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700">
                            Schedule Time
                          </label>
                          <div className="mt-1">
                            <input
                              type="time"
                              name="scheduleTime"
                              id="scheduleTime"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={formData.scheduleTime}
                              onChange={handleInputChange}
                              disabled={!formData.scheduleEnabled}
                              required
                            />
                            <p className="mt-2 text-sm text-gray-500">
                              Time of day to send the leave summary (in 24-hour format).
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="scheduleWorkdaysOnly"
                              name="scheduleWorkdaysOnly"
                              type="checkbox"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={formData.scheduleWorkdaysOnly}
                              onChange={handleInputChange}
                              disabled={!formData.scheduleEnabled}
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="scheduleWorkdaysOnly" className="font-medium text-gray-700">Workdays Only</label>
                            <p className="text-gray-500">When enabled, summaries will only be sent on workdays (Monday-Friday).</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={fetchConfig}
                            disabled={isLoading}
                          >
                            Reset
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving...' : 'Save Configuration'}
                          </button>
                        </div>
                      </form>
                      
                      <div className="mt-10 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Test Slack Integration</h3>
                        <div className="mt-4 space-y-4">
                          <p className="text-sm text-gray-500">
                            Test your Slack integration by sending a test message or a leave summary to the configured channel.
                          </p>
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={handleTestConnection}
                              disabled={isTesting || !savedToken}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300"
                            >
                              {isTesting ? 'Sending...' : 'Send Test Message'}
                            </button>
                            <button
                              type="button"
                              onClick={handleSendSummary}
                              disabled={isTesting || !savedToken}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                            >
                              {isTesting ? 'Sending...' : 'Send Leave Summary'}
                            </button>
                          </div>
                        </div>
                      </div>
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

export default SlackConfigPage;
