import axios from "axios";

// In dev, baseURL is '/api' and Vite proxies it to the backend.
// In production, VITE_API_BASE_URL is the full backend origin.
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || "";
const baseURL = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Request: attach bearer token + anonymous session id
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const sid = localStorage.getItem("datalyze_session");
  if (sid && !config.headers["X-Session-ID"]) {
    config.headers["X-Session-ID"] = sid;
  }

  return config;
});

// Response: handle 401 centrally (no window.location hijack)
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(err);
  },
);

export default api;
