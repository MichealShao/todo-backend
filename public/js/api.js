/**
 * Todo API Service
 * Frontend service for interacting with backend API
 */

class TodoApi {
  constructor(baseUrl = 'http://localhost:5001/api') {
    this.baseUrl = baseUrl;
    this.tasksUrl = `${baseUrl}/tasks`;
    this.authUrl = `${baseUrl}`;
    this.token = localStorage.getItem('token');
  }

  // Set token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  // Get request headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['x-auth-token'] = this.token;
    }
    return headers;
  }

  // User registration
  async register(name, email, password) {
    try {
      const response = await fetch(`${this.authUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Registration failed');
      }
      
      this.setToken(data.token);
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // User login
  async login(email, password) {
    try {
      const response = await fetch(`${this.authUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Login failed');
      }
      
      this.setToken(data.token);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Get user information
  async getUser() {
    try {
      const response = await fetch(`${this.authUrl}/user`, {
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get user information');
      }
      
      return data;
    } catch (error) {
      console.error('Error getting user information:', error);
      throw error;
    }
  }

  // Logout
  logout() {
    this.setToken(null);
  }

  // Get all tasks with pagination, sorting and filtering
  async getTasks(page = 1, limit = 20, sortField = 'priority', sortDirection = 'desc', statusFilter = null) {
    try {
      let url = `${this.tasksUrl}?page=${page}&limit=${limit}&sortField=${sortField}&sortDirection=${sortDirection}`;
      
      // Add status filter parameters
      if (statusFilter && statusFilter.length > 0) {
        url += `&status=${statusFilter.join(',')}`;
      }
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get task list');
      }
      
      return data;
    } catch (error) {
      console.error('Error getting task list:', error);
      throw error;
    }
  }

  // Get single task details
  async getTask(id) {
    try {
      const response = await fetch(`${this.tasksUrl}/${id}`, {
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get task details');
      }
      
      return data;
    } catch (error) {
      console.error('Error getting task details:', error);
      throw error;
    }
  }

  // Create new task
  async createTask(taskData) {
    try {
      const response = await fetch(this.tasksUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to create task');
      }
      
      return data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  // Update task
  async updateTask(id, taskData) {
    try {
      const response = await fetch(`${this.tasksUrl}/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to update task');
      }
      
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  // Batch update task status
  async batchUpdateStatus(taskIds, status) {
    try {
      const response = await fetch(`${this.tasksUrl}/batch-update/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ taskIds, status })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to batch update task status');
      }
      
      return data;
    } catch (error) {
      console.error('Error batch updating task status:', error);
      throw error;
    }
  }

  // Delete task
  async deleteTask(id) {
    try {
      const response = await fetch(`${this.tasksUrl}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to delete task');
      }
      
      return data;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
}

// Export API instance
export default new TodoApi(); 