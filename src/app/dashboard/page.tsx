'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type Leave = {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  } | string;
  startDate: string;
  endDate: string;
  leaveType: string;
  halfDay: {
    isHalfDay: boolean;
    period: 'morning' | 'afternoon' | null;
  };
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt: string;
};

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filteredLeaves, setFilteredLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'name' | 'date'>('name');
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    leaveType: '',
    halfDay: {
      isHalfDay: false,
      period: null as 'morning' | 'afternoon' | null
    }
  });
  const [editFormData, setEditFormData] = useState({
    id: '',
    startDate: '',
    endDate: '',
    reason: '',
    leaveType: '',
    halfDay: {
      isHalfDay: false,
      period: null as 'morning' | 'afternoon' | null
    }
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const router = useRouter();

  const fetchLeaves = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const response = await axios.get('/api/leave', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Ensure we're using the correct data field
      const leaveData = response.data.data || response.data;
      
      // Ensure leaveData is an array
      const leaveArray = Array.isArray(leaveData) ? leaveData : [];
      
      setLeaves(leaveArray);
      setFilteredLeaves(leaveArray);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    fetchLeaves();
  }, [isAuthenticated, router, fetchLeaves]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredLeaves(leaves);
      return;
    }
    
    const filtered = leaves.filter(leave => {
      if (searchBy === 'name') {
        // Check if user is an object with name property
        if (typeof leave.user === 'object' && leave.user !== null) {
          return leave.user.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return false;
      } else if (searchBy === 'date') {
        const searchDate = new Date(searchTerm).toISOString().split('T')[0];
        const leaveStartDate = new Date(leave.startDate).toISOString().split('T')[0];
        return leaveStartDate === searchDate;
      }
      return false;
    });
    
    setFilteredLeaves(filtered);
  }, [leaves, searchTerm, searchBy]);
  
  // Apply search when searchTerm or searchBy changes
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'startDate') {
      // If start date is changed and is after current end date, update the end date as well
      const startDate = new Date(value);
      const currentEndDate = new Date(formData.endDate);
      
      if (!formData.endDate || startDate > currentEndDate) {
        setFormData({
          ...formData,
          startDate: value,
          endDate: value // Set end date to match the new start date
        });
      } else {
        setFormData({
          ...formData,
          [name]: value
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      await axios.post('/api/leave', formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        leaveType: '',
        halfDay: {
          isHalfDay: false,
          period: null
        }
      });
      setShowForm(false);
      fetchLeaves(); // Refresh the list
    } catch (error) {
      console.error('Error creating leave request:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        router.push('/login');
      }
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to delete this leave request?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      await axios.delete(`/api/leave?id=${leaveId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh the leave list
      fetchLeaves();
      alert('Leave request deleted successfully');
    } catch (error) {
      console.error('Error deleting leave request:', error);
      if (axios.isAxiosError(error)) {
        alert(`Error: ${error.response?.data?.error || 'Failed to delete leave request'}`);
      } else {
        alert('An unexpected error occurred');
      }
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleEditLeave = (leave: Leave) => {
    // Convert date strings to YYYY-MM-DD format for the date inputs
    const formatDateForInput = (dateString: string) => {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };
    
    setEditFormData({
      id: leave._id,
      startDate: formatDateForInput(leave.startDate),
      endDate: formatDateForInput(leave.endDate),
      reason: leave.reason,
      leaveType: leave.leaveType,
      halfDay: {
        isHalfDay: leave.halfDay?.isHalfDay || false,
        period: leave.halfDay?.period || null
      }
    });
    
    setShowEditModal(true);
  };
  
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'isHalfDay') {
      setEditFormData({
        ...editFormData,
        halfDay: {
          ...editFormData.halfDay,
          isHalfDay: (e.target as HTMLInputElement).checked
        }
      });
    } else if (name === 'period') {
      setEditFormData({
        ...editFormData,
        halfDay: {
          ...editFormData.halfDay,
          period: value as 'morning' | 'afternoon' | null
        }
      });
    } else if (name === 'startDate') {
      // If start date is changed and is after current end date, update the end date as well
      const startDate = new Date(value);
      const currentEndDate = new Date(editFormData.endDate);
      
      if (!editFormData.endDate || startDate > currentEndDate) {
        // If start date is after end date, set end date to match start date
        setEditFormData({
          ...editFormData,
          startDate: value,
          endDate: value // Set end date to match the new start date
        });
      } else {
        setEditFormData({
          ...editFormData,
          [name]: value
        });
      }
    } else {
      setEditFormData({
        ...editFormData,
        [name]: value
      });
    }
  };
  
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsEditing(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      await axios.patch('/api/leave', editFormData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setShowEditModal(false);
      fetchLeaves(); // Refresh the list
      alert('Leave request updated successfully');
    } catch (error) {
      console.error('Error updating leave request:', error);
      if (axios.isAxiosError(error)) {
        alert(`Error: ${error.response?.data?.error || 'Failed to update leave request'}`);
      } else {
        alert('An unexpected error occurred');
      }
    } finally {
      setIsEditing(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Edit Leave Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Leave Request</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 gap-6 mt-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="editStartDate" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <DatePicker
                    id="editStartDate"
                    selected={editFormData.startDate ? new Date(editFormData.startDate) : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const formattedDate = date.toISOString().split('T')[0];
                        const endDate = editFormData.endDate ? new Date(editFormData.endDate) : null;
                        
                        if (!endDate || date > endDate) {
                          // If start date is after end date, set end date to match start date
                          setEditFormData({
                            ...editFormData,
                            startDate: formattedDate,
                            endDate: formattedDate
                          });
                        } else {
                          setEditFormData({
                            ...editFormData,
                            startDate: formattedDate
                          });
                        }
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editEndDate" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <DatePicker
                    id="editEndDate"
                    selected={editFormData.endDate ? new Date(editFormData.endDate) : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setEditFormData({
                          ...editFormData,
                          endDate: date.toISOString().split('T')[0]
                        });
                      }
                    }}
                    minDate={editFormData.startDate ? new Date(editFormData.startDate) : undefined}
                    dateFormat="yyyy-MM-dd"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editLeaveType" className="block text-sm font-medium text-gray-700">
                    Leave Type
                  </label>
                  <input
                    type="text"
                    id="editLeaveType"
                    name="leaveType"
                    required
                    value={editFormData.leaveType}
                    onChange={handleEditInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter leave type (e.g., Annual, Sick, Personal)"
                  />
                </div>
                <div>
                  <label htmlFor="editReason" className="block text-sm font-medium text-gray-700">
                    Reason
                  </label>
                  <textarea
                    id="editReason"
                    name="reason"
                    rows={2}
                    value={editFormData.reason}
                    onChange={handleEditInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="editIsHalfDay"
                        name="isHalfDay"
                        type="checkbox"
                        checked={editFormData.halfDay.isHalfDay}
                        onChange={handleEditInputChange}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="editIsHalfDay" className="font-medium text-gray-700">Half Day</label>
                    </div>
                  </div>
                </div>
                {editFormData.halfDay.isHalfDay && (
                  <div>
                    <label htmlFor="editPeriod" className="block text-sm font-medium text-gray-700">
                      Period
                    </label>
                    <select
                      id="editPeriod"
                      name="period"
                      required={editFormData.halfDay.isHalfDay}
                      value={editFormData.halfDay.period || ''}
                      onChange={handleEditInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">Select period</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-6 flex items-center justify-end gap-x-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-sm font-semibold leading-6 text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-300"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Image
                  className="h-8 w-auto"
                  src="/leave-logo.svg"
                  alt="LMS"
                  width={200}
                  height={50}
                />
              </div>
              <div className="ml-6 flex items-center space-x-4">
                <span className="text-gray-900 font-medium">Dashboard</span>
                {user?.role === 'admin' && (
                  <>
                    <a
                      href="/admin/users"
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      User Management
                    </a>
                    <Link
                      href="/admin/slack"
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      Slack Configuration
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 mr-4">
                  Welcome, {user?.name}
                </span>
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className="mr-2 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">Leave Requests</h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center space-x-4 w-2/3">
                  <div className="relative rounded-md shadow-sm flex-grow">
                    <input
                      type={searchBy === 'date' ? 'date' : 'text'}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                      placeholder={searchBy === 'name' ? "Search by user name..." : ""}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <select
                        id="searchBy"
                        name="searchBy"
                        className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
                        onChange={(e) => setSearchBy(e.target.value as 'name' | 'date')}
                        value={searchBy}
                      >
                        <option value="name">By Name</option>
                        <option value="date">By Date</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={handleSearch}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Search
                  </button>
                </div>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {showForm ? 'Cancel' : 'Create New Leave Request'}
                </button>
              </div>

              {showForm && (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">New Leave Request</h3>
                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                      <div>
                        <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700">
                          Leave Type
                        </label>
                        <input
                          type="text"
                          id="leaveType"
                          name="leaveType"
                          required
                          value={formData.leaveType}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="Enter leave type (e.g., Annual, Sick, Personal)"
                        />
                      </div>
                      <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                          Start Date
                        </label>
                        <DatePicker
                          id="startDate"
                          selected={formData.startDate ? new Date(formData.startDate) : null}
                          onChange={(date: Date | null) => {
                            if (date) {
                              const formattedDate = date.toISOString().split('T')[0];
                              const endDate = formData.endDate ? new Date(formData.endDate) : null;
                              
                              if (!endDate || date > endDate) {
                                // If start date is after end date, set end date to match start date
                                setFormData({
                                  ...formData,
                                  startDate: formattedDate,
                                  endDate: formattedDate
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  startDate: formattedDate
                                });
                              }
                            }
                          }}
                          dateFormat="yyyy-MM-dd"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholderText="Select start date"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                          End Date
                        </label>
                        <DatePicker
                          id="endDate"
                          selected={formData.endDate ? new Date(formData.endDate) : null}
                          onChange={(date: Date | null) => {
                            if (date) {
                              setFormData({
                                ...formData,
                                endDate: date.toISOString().split('T')[0]
                              });
                            }
                          }}
                          minDate={formData.startDate ? new Date(formData.startDate) : undefined}
                          dateFormat="yyyy-MM-dd"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholderText="Select end date"
                          required
                        />
                      </div>
                      <div className="flex items-center my-4">
                        <input
                          id="isHalfDay"
                          type="checkbox"
                          checked={formData.halfDay.isHalfDay}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              halfDay: {
                                ...formData.halfDay,
                                isHalfDay: e.target.checked
                              }
                            });
                          }}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isHalfDay" className="ml-2 block text-sm text-gray-700">
                          Half-day leave (AM/PM)
                        </label>
                      </div>
                      {formData.halfDay.isHalfDay && (
                        <div className="ml-6 mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Leave Period
                          </label>
                          <div className="flex space-x-4">
                            <div className="flex items-center">
                              <input
                                id="morning"
                                type="radio"
                                name="period"
                                value="morning"
                                checked={formData.halfDay.period === 'morning'}
                                onChange={() => {
                                  setFormData({
                                    ...formData,
                                    halfDay: {
                                      ...formData.halfDay,
                                      period: 'morning'
                                    }
                                  });
                                }}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                              />
                              <label htmlFor="morning" className="ml-2 block text-sm text-gray-700">
                                AM
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                id="afternoon"
                                type="radio"
                                name="period"
                                value="afternoon"
                                checked={formData.halfDay.period === 'afternoon'}
                                onChange={() => {
                                  setFormData({
                                    ...formData,
                                    halfDay: {
                                      ...formData.halfDay,
                                      period: 'afternoon'
                                    }
                                  });
                                }}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                              />
                              <label htmlFor="afternoon" className="ml-2 block text-sm text-gray-700">
                                PM
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                          Reason <span className="text-gray-500 text-xs">(optional)</span>
                        </label>
                        <textarea
                          id="reason"
                          name="reason"
                          rows={3}
                          value={formData.reason}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="Enter reason for leave (optional)"
                        />
                      </div>
                      <div className="pt-5">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-10">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : filteredLeaves.length === 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <p className="text-gray-500">No leave requests found.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                      <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                User
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Type
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Start Date
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                End Date
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Leave
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Reason
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Created At
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLeaves.map((leave) => (
                              <tr key={leave._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {typeof leave.user === 'object' && leave.user !== null 
                                    ? leave.user.name 
                                    : 'Unknown User'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {leave.leaveType}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(leave.startDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(leave.endDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {leave.halfDay?.isHalfDay ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {leave.halfDay.period === 'morning' ? 'AM' : 'PM'}
                                    </span>
                                  ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                      Full-Day
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {leave.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                    ${
                                      leave.status === 'approved'
                                        ? 'bg-green-100 text-green-800'
                                        : leave.status === 'rejected'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(leave.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {(typeof leave.user === 'object' && leave.user?._id === user?._id) && (
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleEditLeave(leave)}
                                        className="text-indigo-600 hover:text-indigo-900"
                                        disabled={isEditing}
                                      >
                                        {isEditing && leave._id === editFormData.id ? 'Editing...' : 'Edit'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLeave(leave._id)}
                                        className="text-red-600 hover:text-red-900"
                                        disabled={isDeleting}
                                      >
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <ChangePasswordModal 
          isOpen={showChangePasswordModal} 
          onClose={() => setShowChangePasswordModal(false)} 
        />
      )}
    </div>
  );
}
