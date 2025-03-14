'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department: string;
  createdAt: string;
  updatedAt: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: () => void;
}

export default function EditUserModal({ isOpen, onClose, user, onUserUpdated }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: '', // Empty by default - will only update if provided
    role: user.role,
    department: user.department,
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    // Update form data when user changes
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department,
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const token = await getToken();
      
      // Create payload - only include password if not empty
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
      };
      
      if (formData.password) {
        Object.assign(payload, { password: formData.password });
      }

      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      onUserUpdated();
    } catch (err: any) {
      setError(err.message || 'Error updating user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit User</h3>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-2 text-left">
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password <span className="text-gray-500 text-xs">(leave empty to keep current)</span>
              </label>
              <input
                type="password"
                name="password"
                id="password"
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                name="role"
                id="role"
                required
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <input
                type="text"
                name="department"
                id="department"
                required
                value={formData.department}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={onClose}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-24 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
