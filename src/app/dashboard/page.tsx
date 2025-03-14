'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import ChangePasswordModal from '@/components/ChangePasswordModal';

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
  const router = useRouter();

  // If not authenticated, redirect to login
  useEffect(() => {
    // Check if user is logged in
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
  }, [isAuthenticated, router]);

  const fetchLeaves = async () => {
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
      setLeaves(response.data);
      setFilteredLeaves(response.data);
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
  };
  
  const handleSearch = () => {
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
  };
  
  // Apply search when searchTerm or searchBy changes
  useEffect(() => {
    handleSearch();
  }, [searchTerm, searchBy]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
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

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Image
                  className="h-8 w-auto"
                  src="/leave-logo.svg"
                  alt="Leave Management System"
                  width={200}
                  height={50}
                />
              </div>
              <div className="ml-6 flex items-center space-x-4">
                <span className="text-gray-900 font-medium">Dashboard</span>
                {user?.role === 'admin' && (
                  <a
                    href="/admin/users"
                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                  >
                    User Management
                  </a>
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
                        <input
                          type="date"
                          name="startDate"
                          id="startDate"
                          required
                          value={formData.startDate}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                          End Date
                        </label>
                        <input
                          type="date"
                          name="endDate"
                          id="endDate"
                          required
                          value={formData.endDate}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
