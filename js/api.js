// ─────────────────────────────────────────────────────────────────────────────
// EventsLK Client Portal — API client
//
// Talks ONLY to the Kong API gateway (the single external entry point). Kong
// proxies the backend paths as-is (strip_path: false), so we call them directly:
//   /auth/*   /event/*   /book/*
//
// Base URL comes from window.ENV.API_BASE_URL (env-config.js, injected at runtime).
// ─────────────────────────────────────────────────────────────────────────────

function resolveApiBase() {
  const root = (window.ENV && window.ENV.API_BASE_URL) ? window.ENV.API_BASE_URL : '';
  return root.replace(/\/+$/, '');
}

class ClientApiService {
  constructor() {
    this.user = JSON.parse(localStorage.getItem('client_user') || 'null');
    this.token = localStorage.getItem('client_token') || null;
  }

  get baseUrl() {
    return resolveApiBase();
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, config);
    } catch (networkErr) {
      console.error('Network error:', networkErr);
      throw new Error('Cannot reach the API gateway. Please try again shortly.');
    }

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { message: text };
    }

    // Session expired on an authenticated call — clear and let the page redirect.
    if (response.status === 401 && this.token) {
      this.logout(false);
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    return data;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  async login(email, password) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    if (data && data.message === 'success') {
      localStorage.setItem('client_user', JSON.stringify(data.user));
      localStorage.setItem('client_token', data.jwtToken);
      this.user = data.user;
      this.token = data.jwtToken;
      return data;
    }
    // Surface the not-verified case so the UI can offer to resend.
    const err = new Error(data.message || 'Login failed');
    err.code = data.message;            // e.g. "email not verified"
    throw err;
  }

  async signup(userData) {
    const data = await this.request('/auth/signup', 'POST', userData);
    if (data && data.message === 'success') return data;
    throw new Error(data.message || 'Signup failed');
  }

  verifyEmail(token) {
    return this.request(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  }

  resendVerification(email) {
    return this.request('/auth/resend-verification', 'POST', { email });
  }

  logout(redirect = true) {
    localStorage.removeItem('client_user');
    localStorage.removeItem('client_token');
    this.user = null;
    this.token = null;
    if (redirect) window.location.href = '/index.html';
  }

  isAuthenticated() {
    return this.user !== null && this.token !== null;
  }

  // ── Events (public) ──────────────────────────────────────────────────────────
  getEvents() { return this.request('/event'); }
  getEvent(eventId) { return this.request(`/event/${encodeURIComponent(eventId)}`); }

  // ── Bookings (USER) ──────────────────────────────────────────────────────────
  bookEvent(eventId, userId, requestedSeats = 1) {
    return this.request('/book', 'POST', {
      eventId: eventId,
      userId: userId,
      localDateTime: new Date().toISOString().slice(0, 19),
      requestedSeats: Number(requestedSeats) || 1
    });
  }

  getUserBookings(userId) {
    return this.request(`/book/user/${encodeURIComponent(userId)}`);
  }

  cancelBooking(bookingId) {
    return this.request(`/book/${encodeURIComponent(bookingId)}`, 'DELETE');
  }
}

const api = new ClientApiService();
