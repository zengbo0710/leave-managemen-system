'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department: string;
}

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserDeleted: () => void;
}

export default function DeleteUserModal({ isOpen, onClose, user, onUserDeleted }: DeleteUserModalProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken } = useAuth();

  const handleDelete = async () => {
    setError('');
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      onUserDeleted();
    } catch (err: any) {
      setError(err.message || 'Error deleting user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Confirm Delete</h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete <strong>{user.name}</strong>?
              {user.role === 'admin' && (
                <span className="block mt-2 text-yellow-600 font-medium">
                  Warning: This is an admin user!
                </span>
              )}
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-left">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="w-24 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
