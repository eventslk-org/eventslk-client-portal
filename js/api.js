const API_BASE_URL = (window._env_ && window._env_.API_BASE_URL)
  ? window._env_.API_BASE_URL
  : 'http://localhost:8080';

class ClientApiService {
  constructor() {
    this.user = JSON.parse(localStorage.getItem('client_user') || 'null');
    this.token = localStorage.getItem('client_token') || null;
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Attach JWT token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = { method, headers };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { message: text };
      }
      
      if (!response.ok) {
        throw new Error(data.message || `API request failed with status ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    // UserResponse: { status, message, user, jwtToken }
    if (data && data.message === 'success') {
       localStorage.setItem('client_user', JSON.stringify(data.user));
       localStorage.setItem('client_token', data.jwtToken);
       this.user = data.user;
       this.token = data.jwtToken;
       return data;
    } else {
       throw new Error(data.message || 'Login failed');
    }
  }

  async signup(userData) {
    const data = await this.request('/auth/signup', 'POST', userData);
    // UserResponse: { status, message }
    if (data && data.message === 'success') {
       return data;
    } else {
       throw new Error(data.message || 'Signup failed');
    }
  }

  logout() {
    localStorage.removeItem('client_user');
    localStorage.removeItem('client_token');
    this.user = null;
    this.token = null;
    window.location.href = 'index.html';
  }

  isAuthenticated() {
    return this.user !== null && this.token !== null;
  }

  // Events — public endpoint, no auth needed
  getEvents() { return this.request('/event'); }

  // Bookings — requires USER role
  bookEvent(eventId, userId) {
    return this.request('/book', 'POST', {
        eventId: eventId,
        userId: userId,
        localDateTime: new Date().toISOString().slice(0, 19)
    });
  }

  getUserBookings(userId) {
    return this.request(`/book/user/${userId}`);
  }

  cancelBooking(bookingId) {
    return this.request(`/book/${bookingId}`, 'DELETE');
  }
}

const api = new ClientApiService();
