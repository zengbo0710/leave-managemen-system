'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import UserTable from './components/UserTable';
import AddUserModal from './components/AddUserModal';
import EditUserModal from './components/EditUserModal';
import DeleteUserModal from './components/DeleteUserModal';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department: string;
  createdAt: string;
  updatedAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { user, getToken } = useAuth();
  const router = useRouter();

  // Ensure only admins can access this page
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch users
  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = await getToken();
      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching users');
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  // Handle user actions
  const handleAddUser = () => {
    setIsAddUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserModalOpen(true);
  };

  // If not authenticated or loading, show loading state
  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If not admin, redirect (already handled in useEffect)
  if (user.role !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <a
            href="/dashboard"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </a>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        </div>
        <button
          onClick={handleAddUser}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
        >
          Add New User
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <UserTable 
        users={users} 
        onEdit={handleEditUser} 
        onDelete={handleDeleteUser} 
      />

      {isAddUserModalOpen && (
        <AddUserModal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          onUserAdded={() => {
            fetchUsers();
            setIsAddUserModalOpen(false);
          }}
        />
      )}

      {isEditUserModalOpen && selectedUser && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => setIsEditUserModalOpen(false)}
          user={selectedUser}
          onUserUpdated={() => {
            fetchUsers();
            setIsEditUserModalOpen(false);
          }}
        />
      )}

      {isDeleteUserModalOpen && selectedUser && (
        <DeleteUserModal
          isOpen={isDeleteUserModalOpen}
          onClose={() => setIsDeleteUserModalOpen(false)}
          user={selectedUser}
          onUserDeleted={() => {
            fetchUsers();
            setIsDeleteUserModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
