# Client Frontend (EventXP)

The Client Frontend is a modern, responsive web platform for discovering and booking events. Users can browse upcoming events, create accounts, authenticate, make bookings, and manage their event tickets. It is built with HTML, CSS, and vanilla JavaScript, served by Nginx, and deployed as a containerized application on Kubernetes.

## Features

- **Event Discovery**: Browse all upcoming events in a responsive card-based grid.
- **User Authentication**: Sign in or sign up with email and password verification.
- **Event Booking**: Reserve spots at events with a simple booking modal.
- **Booking Management**: View and manage all personal event bookings.
- **Responsive Design**: Modern glassmorphism UI with vibrant purple/pink gradient theme, optimized for mobile, tablet, and desktop.
- **JWT-Based Security**: Token-based authentication with secure API communication.

## Architecture

```
Request Flow:
Client Browser → Nginx (port 80) → API routes proxy to backend (http://backend:8080)
                               → Static files served directly
```

Nginx routes:
- `/` → serves static HTML, CSS, JS files.
- `/api/*` → proxied to `http://backend:8080/` (backend API).

## Pages and Routes

| Page | File | Purpose |
|------|------|---------|
| Event Discovery | `index.html` | Browse all events, filter, and initiate bookings. |
| Authentication | `auth.html` | Sign in or sign up. Toggleable forms on one page. |
| My Bookings | `profile.html` | View all personal event bookings and reservations. |

## Styling and Design

- **CSS**: `css/style.css` contains all styling using CSS custom properties (dark theme with glassmorphism).
- **Color Scheme**:
  - Primary (Purple): `#8b5cf6`
  - Secondary (Pink): `#ec4899`
  - Success (Green): `#10b981`
  - Danger (Red): `#ef4444`
  - Background: Dark gradient from `#0f172a` to `#1e1b4b`
- **Fonts**: Outfit (Google Fonts) for modern, sleek typography.
- **Effects**: Backdrop blur, smooth transitions, hover animations.

## Prerequisites

- Node.js (optional, for local HTTP server if not using Docker).
- Docker and Docker Compose (for containerized deployment).
- Backend API running (at `http://backend:8080` or configured via environment).

## Local Development

### Quick Static Serve with Python

```bash
cd client-frontend
python3 -m http.server 8081
```

Then open `http://localhost:8081/` in your browser.

**Note**: API calls to `/api/*` will fail locally unless you:
1. Run the backend separately and update Nginx configuration, or
2. Set up the proper proxy environment.

### With Docker (Recommended)

Build the image:

```bash
cd client-frontend
docker build -t eventslk-client-portal:local .
```

Run the container:

```bash
docker run -d \
  -p 8081:80 \
  --name eventslk-client \
  --network host \
  eventslk-client-portal:local
```

Access at `http://localhost:8081/` to start discovering and booking events.

### With Docker Compose

From the project root:

```bash
docker-compose up client-frontend
```

## Docker Build

### Build Process

The `Dockerfile` uses a single-stage Nginx Alpine image:

```dockerfile
FROM nginx:alpine

# Copy static frontend files
COPY index.html auth.html profile.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# Custom nginx config for API proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
```

Build:

```bash
docker build -t kaveengayanga12/eventslk-client-portal:latest .
```

Push to registry:

```bash
docker push kaveengayanga12/eventslk-client-portal:latest
```

## Kubernetes Deployment

The deployment is defined in `k8s-manifests/client-portal-deployment.yaml` and includes:

- **Service Type**: NodePort (exposes port `30081`).
- **Node Selection**: `nodeSelector: node-role=application`.
- **Replicas**: 1.
- **Health Checks**: Readiness and liveness probes on `/`.

### Apply to Cluster

```bash
kubectl apply -f k8s-manifests/client-portal-deployment.yaml
```

### Access

- **Cluster Internal**: `http://client-portal/`
- **External via NodeIP**: `http://<NodeIP>:30081/`

Example: `http://44.196.73.203:30081/`

## Authentication and Authorization

### Sign-Up Flow

1. User navigates to `auth.html` with `?mode=register` or clicks "Get Started".
2. User fills in first name, last name, email, and password.
3. Frontend calls `POST /auth/signup` with user data.
4. Backend validates and creates user account.
5. User is redirected to login form with success message.

### Sign-In Flow

1. User enters email and password on login form.
2. Frontend calls `POST /auth/login` via `ClientApiService`.
3. Backend validates credentials and returns `{ jwtToken, user, message, status }`.
4. Frontend stores JWT in `localStorage` as `client_token` and user in `client_user` JSON.
5. JWT is added to all subsequent API requests via `Authorization: Bearer <token>` header.

### Session Management

- **Login**: Save token and user data to `localStorage`.
- **Logout**: Clear `localStorage` and redirect to `index.html`.
- **Session Persistence**: Token persists across browser refresh until manually logged out.
- **Protected Pages**: `profile.html` redirects unauthenticated users to `auth.html`.

## API Integration

### API Service (`js/api.js`)

All API calls are made through the `ClientApiService` class:

```javascript
const api = new ClientApiService();
```

Methods:

```javascript
// Authentication
await api.login(email, password);
await api.signup({ email, password, firstName, lastName });
await api.logout();
await api.isAuthenticated();

// Events (public)
await api.getEvents();

// Bookings (requires authentication)
await api.bookEvent(eventId, userId);
await api.getUserBookings(userId);
await api.cancelBooking(bookingId);
```

### Base URL

- **API Base**: `/api` (proxied by Nginx to `http://backend:8080/`)
- **Inside K8s**: Nginx is on same Pod, proxy resolves to backend Service DNS.
- **Direct calls**: If needed, raw fetch can target `http://backend:8080/` directly.

## User Workflows

### Browse Events

1. User visits `index.html` (default landing page).
2. Frontend fetches all events via `GET /api/event`.
3. Each event is displayed as a card with name, location, and "Target Ticket" button.
4. Unauthenticated users see "Sign In" and "Get Started" in navbar.

### Book an Event

1. User clicks "Target Ticket" on an event card.
2. A modal opens showing event details (name, location, dates, description).
3. Authenticated users see a "Confirm Booking" button; unauthenticated are redirected to login.
4. On confirmation, frontend calls `POST /api/book` with `{ eventId, userId, localDateTime }`.
5. Backend creates booking and returns confirmation.
6. Modal closes and user can view booking in profile.

### Manage Bookings

1. Authenticated user clicks "My Bookings" in navbar (or navigates to `profile.html`).
2. Frontend fetches bookings via `GET /api/book/user/{userId}`.
3. Page displays all confirmed bookings with event details and cancel option.
4. User can cancel a booking by clicking "Cancel" button (calls `DELETE /api/book/{bookingId}`).

## Environment Configuration

### Environment Variables

The frontend respects the following environment variables at runtime:

- `API_BASE_URL` (default: `/api`): Override the API base path for development.

### Configuring API Endpoint

Edit `nginx.conf` to change the backend upstream:

```nginx
location /api/ {
    proxy_pass http://backend:8080/;
    # ...
}
```

Or in Kubernetes deployment, override via init container or ConfigMap if dynamic configuration is needed.

## Security Considerations

- **JWT Storage**: Token stored in `localStorage` (vulnerable to XSS). For production, consider:
  - HTTP-only cookies with Secure flag.
  - Session tokens managed server-side.
  - Content Security Policy (CSP) headers.

- **CORS**: Backend has `@CrossOrigin` enabled; review before production.

- **Credentials**: Never hardcode credentials; use environment variables or secrets.

- **HTTPS**: Always use HTTPS in production.

- **Password Validation**: Frontend performs basic validation; backend must enforce strong password policies.

## Browser Compatibility

- Modern browsers with ES6 support.
- No polyfills or build step required (vanilla JavaScript).
- Responsive design supports mobile (via viewport meta tag), tablet, and desktop.

## Troubleshooting

### Events Not Loading

**Issue**: Grid shows "Loading events..." indefinitely or displays "No upcoming events available".

**Cause**: Backend is not running, `/api/event` endpoint fails, or no events exist in DB.

**Solution**:
1. Verify backend is running: `curl http://backend:8080/event`
2. Check Nginx proxy config in `nginx.conf`.
3. Verify events exist in the MySQL database.

### Login or Signup Fails

**Issue**: "Login failed" or "Signup failed" error, or 401 response.

**Cause**: Backend down, invalid credentials, or JWT_SECRET mismatch.

**Solution**:
1. Verify backend is running: `curl http://backend:8080/auth`
2. Check backend logs for credential validation errors.
3. Verify JWT_SECRET matches between backend deployments.

### Booking Fails

**Issue**: "Failed to book event" error or booking does not appear in My Bookings.

**Cause**: Backend booking service error, full capacity, or user already booked.

**Solution**:
1. Check backend logs for booking errors.
2. Verify event still has available capacity.
3. Reload profile to refresh booking list.

### Blank Page or Styling Issues

**Issue**: Page loads but appears blank or unstyled.

**Cause**: CSS or JavaScript files not loading, or CORS policy.

**Solution**:
1. Check browser console for 404 errors on CSS/JS.
2. Verify Nginx is serving static files from `/usr/share/nginx/html/`.
3. Ensure `nginx.conf` does not block CSS/JS routes.

### Mobile Display Issues

**Issue**: Layout is broken or text is truncated on mobile.

**Cause**: Responsive design CSS not loading or viewport meta tag missing.

**Solution**:
1. Verify `<meta name="viewport" content="width=device-width, initial-scale=1.0">` is in HTML head.
2. Check media queries in `css/style.css`.
3. Test in browser's mobile device emulation mode.

## Development Guidelines

### Modifying Pages

1. Edit the HTML file directly (e.g., `index.html`).
2. Keep all JavaScript inline in `<script>` tags or reference external in `js/`.
3. Maintain the button/link classes and Navbar structure for consistency.
4. Test locally with `python3 -m http.server` or Docker.

### Extending API Methods

Add new methods to the `ClientApiService` class in `js/api.js`:

```javascript
async getEventById(eventId) {
  return this.request(`/event/${eventId}`, 'GET');
}
```

### Adding Pages

1. Create a new HTML file (e.g., `search.html`).
2. Include the same navbar structure and authentication check.
3. Reference `api.js` and `css/style.css`.
4. Add a new navigation link in the navbar of all pages.

### Styling

All colors and spacing use CSS custom properties. To customize:

```css
:root {
  --primary: #8b5cf6;
  --secondary: #ec4899;
  /* ... */
}
```

Update `css/style.css` and rebuild the Docker image.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/main.yml`) automates:

1. **Build** the Docker image on push to `main`.
2. **Push** the image to Docker Hub with:
   - Commit SHA tag (e.g., `5d7eb8a463e...`).
   - `latest` tag.
3. **Update** the external Kubernetes manifests repository with the new image tag.
4. **Deploy** via GitOps (ArgoCD or manual `kubectl apply`).

To manually trigger a deployment after changes:

```bash
git add .
git commit -m "Add event filtering feature"
git push origin main
```

The workflow will:
- Build and push `kaveengayanga12/eventslk-client-portal:<commit-sha>`.
- Update `client-portal-deployment.yaml` in the manifests repo.

## Performance Considerations

- **Grid Layout**: Event cards use CSS Grid with auto-fit for responsive layout.
- **Lazy Loading**: Events are fetched once on page load; no pagination implemented yet.
- **Caching**: Browser caches CSS/JS with `?v=` query string versioning.
- **Smooth Animations**: Transitions use `cubic-bezier` for natural motion.

## Future Enhancements

- Event search and filtering by category, location, date range.
- Event recommendations based on user booking history.
- Rating and review system for events.
- Social sharing of event bookings.
- Integration with payment gateways.
- Email confirmation and reminders for bookings.

## License

This module is part of the EventSLK platform. See the top-level `LICENSE` for licensing information.

## Support and Contribution

For issues or feature requests, refer to the main EventSLK repository's issue tracker.

For local development support, see [../README.md](../README.md) for system-wide setup instructions.
